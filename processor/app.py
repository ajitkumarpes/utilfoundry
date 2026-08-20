"""
Processor shim: a pure stateless executor for OCR and Office-document conversion.
Bytes in, bytes out. No knowledge of jobs, queues, or storage - that's all owned by the
Spring Boot backend, which calls this over HTTP.

Every subprocess call uses an argv list (never shell=True with interpolated strings) and every
caller-supplied parameter is checked against a fixed allow-list before it ever reaches a
subprocess - this endpoint takes file uploads and shells out to native tools, which is the
classic command-injection shape, so this isn't optional hardening.
"""

import shutil
import subprocess
import tempfile
import threading
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

app = FastAPI()

ALLOWED_LANGUAGES = {"eng", "hin"}
# No "xlsx": LibreOffice has no PDF-import path into Calc at all (no calc_pdf_import filter is
# registered, unlike Writer/Impress) - forcing it opens the PDF as a Draw document and crashes
# soffice on export. PDF -> Excel would need a different approach entirely (table extraction,
# not a format conversion) - out of scope here, not a bug to work around.
ALLOWED_TARGET_FORMATS = {"pdf", "docx", "pptx"}

OCR_TIMEOUT_SECONDS = 600
OFFICE_TIMEOUT_SECONDS = 90

CONTENT_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

# soffice's bare "--convert-to pdf" is unambiguous regardless of source type, but converting
# FROM a PDF to an Office format needs the explicit export filter name - "no export filter
# found" otherwise, since LibreOffice can't disambiguate which app context (Writer/Impress)
# to export a PDF under from the extension alone.
CONVERT_TO_SPEC = {
    "pdf": "pdf",
    "docx": "docx:MS Word 2007 XML",
    "pptx": "pptx:Impress MS PowerPoint 2007 XML",
}

# Without this, LibreOffice opens any PDF via its default Draw handling, then fails (docx) or
# crashes (would-be xlsx) trying to export Draw content through a Writer/Impress-specific
# filter. Confirmed directly: "convert input.pdf as a Draw document -> ... using filter: MS
# Word 2007 XML" followed by a write error, vs "as a Writer document" and a clean export once
# this infilter is forced. Only applies to the PDF-as-source direction.
PDF_SOURCE_INFILTER = {
    "docx": "writer_pdf_import",
    "pptx": "impress_pdf_import",
}

# soffice --headless is well documented as unreliable under concurrent invocation against a
# shared profile. Serialize conversions through this lock; OCR never touches it and runs with
# real concurrency (bounded only by the caller).
_soffice_lock = threading.Lock()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/process/ocr")
async def process_ocr(file: UploadFile = File(...), language: str = Form("eng")):
    if language not in ALLOWED_LANGUAGES:
        raise HTTPException(
            status_code=400, detail=f"language must be one of {sorted(ALLOWED_LANGUAGES)}."
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    with tempfile.TemporaryDirectory(dir="/workspace") as workdir:
        input_path = Path(workdir) / "input.pdf"
        output_path = Path(workdir) / "output.pdf"
        input_path.write_bytes(content)

        try:
            result = subprocess.run(
                [
                    "ocrmypdf",
                    "--language",
                    language,
                    "--skip-text",
                    "--output-type",
                    "pdf",
                    str(input_path),
                    str(output_path),
                ],
                capture_output=True,
                timeout=OCR_TIMEOUT_SECONDS,
                check=False,
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=504, detail="OCR timed out.")

        if result.returncode != 0 or not output_path.exists():
            raise HTTPException(status_code=422, detail=_tail_stderr(result))

        return Response(content=output_path.read_bytes(), media_type="application/pdf")


@app.post("/process/office-convert")
async def process_office_convert(
    file: UploadFile = File(...), target_format: str = Form(...)
):
    if target_format not in ALLOWED_TARGET_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"target_format must be one of {sorted(ALLOWED_TARGET_FORMATS)}.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    source_suffix = Path(file.filename or "input").suffix or ".bin"

    with tempfile.TemporaryDirectory(dir="/workspace") as workdir:
        input_path = Path(workdir) / f"input{source_suffix}"
        outdir = Path(workdir) / "out"
        outdir.mkdir()
        profile_dir = Path(workdir) / "profile"
        input_path.write_bytes(content)

        # A fresh, unique profile per call sidesteps soffice's stale-lock poisoning when a
        # previous invocation was killed - cheaper than detecting/cleaning a shared lock after
        # the fact.
        user_installation_flag = f"-env:UserInstallation=file://{profile_dir}"

        infilter_args = []
        if target_format in PDF_SOURCE_INFILTER:
            infilter_args = [f"--infilter={PDF_SOURCE_INFILTER[target_format]}"]

        with _soffice_lock:
            try:
                result = subprocess.run(
                    [
                        "soffice",
                        "--headless",
                        "--norestore",
                        user_installation_flag,
                        *infilter_args,
                        "--convert-to",
                        CONVERT_TO_SPEC[target_format],
                        "--outdir",
                        str(outdir),
                        str(input_path),
                    ],
                    capture_output=True,
                    timeout=OFFICE_TIMEOUT_SECONDS,
                    check=False,
                )
            except subprocess.TimeoutExpired:
                raise HTTPException(status_code=504, detail="Conversion timed out.")
            finally:
                shutil.rmtree(profile_dir, ignore_errors=True)

        output_path = outdir / f"{input_path.stem}.{target_format}"
        if result.returncode != 0 or not output_path.exists():
            raise HTTPException(status_code=422, detail=_tail_stderr(result))

        return Response(
            content=output_path.read_bytes(), media_type=CONTENT_TYPES[target_format]
        )


def _tail_stderr(result: subprocess.CompletedProcess, limit: int = 800) -> str:
    text = result.stderr.decode("utf-8", errors="replace").strip()
    return text[-limit:] if text else "Processing failed on this file."
