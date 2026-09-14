from __future__ import annotations

import io
import os
import re
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
import pytesseract
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse, Response
from PIL import Image, ImageOps, UnidentifiedImageError
from pytesseract import Output

MAX_BYTES = 32 * 1024 * 1024
MAX_PIXELS = 40_000_000
MAX_OCR_DIMENSION = 3_200
MODEL_DIR = Path(os.getenv("MODEL_DIR", "/models"))
DEFAULT_LANGUAGE = os.getenv("OCR_LANG", "eng")
ALLOWED_TOOLS = {"ocr", "screenshot-to-text", "remove-background", "upscale"}
LANGUAGE_PATTERN = re.compile(r"^[a-z]{3}(?:\+[a-z]{3})*$")

app = FastAPI(title="UtilFoundry Image Worker", docs_url=None, redoc_url=None)


def error(message: str, status: int = 400) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status, headers={"Cache-Control": "no-store"})


def safe_name(value: str, suffix: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9._-]+", "-", value or "image").strip("-") or "image"
    clean = re.sub(r"\.[^.]+$", "", clean)
    return f"{clean}-{suffix}"


def open_image(data: bytes) -> Image.Image:
    if not data or len(data) > MAX_BYTES:
        raise ValueError("Images must be between 1 byte and 32 MB.")
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("The file is not a supported image.") from exc
    if not image.width or not image.height or image.width * image.height > MAX_PIXELS:
        raise ValueError("The image dimensions are too large to process safely.")
    return image


def ocr_image(image: Image.Image, language: str, psm: int) -> dict[str, object]:
    if not LANGUAGE_PATTERN.fullmatch(language):
        raise ValueError("Choose a supported OCR language code.")
    available = set(pytesseract.get_languages(config=""))
    missing = [item for item in language.split("+") if item not in available]
    if missing:
        raise ValueError(f"OCR language not installed: {', '.join(missing)}.")
    if psm not in {3, 6, 11, 12, 13}:
        raise ValueError("Choose a supported OCR page layout mode.")

    prepared = image.convert("RGB")
    scale = min(1.0, MAX_OCR_DIMENSION / max(prepared.width, prepared.height))
    if scale < 1:
        prepared = prepared.resize((max(1, int(prepared.width * scale)), max(1, int(prepared.height * scale))), Image.Resampling.LANCZOS)
    prepared = ImageOps.autocontrast(ImageOps.grayscale(prepared))
    config = f"--oem 3 --psm {psm}"
    text = pytesseract.image_to_string(prepared, lang=language, config=config, timeout=25).strip()
    data = pytesseract.image_to_data(prepared, lang=language, config=config, output_type=Output.DICT, timeout=25)
    confidences = [float(value) for value in data["conf"] if value and float(value) >= 0]
    confidence = round(sum(confidences) / len(confidences), 1) if confidences else None
    return {"text": text, "confidence": confidence, "language": language, "width": image.width, "height": image.height}


@lru_cache(maxsize=1)
def background_session():
    from rembg import new_session

    model_path = MODEL_DIR / "u2netp.onnx"
    if not model_path.exists():
        raise RuntimeError("Background-removal model is not installed.")
    return new_session("u2netp", providers=["CPUExecutionProvider"])


def remove_background(data: bytes) -> bytes:
    from rembg import remove

    output = remove(data, session=background_session(), post_process_mask=True)
    return bytes(output)


@lru_cache(maxsize=1)
def super_resolution():
    model_path = MODEL_DIR / "FSRCNN_x2.pb"
    if not model_path.exists():
        raise RuntimeError("Upscaling model is not installed.")
    processor = cv2.dnn_superres.DnnSuperResImpl_create()
    processor.readModel(str(model_path))
    processor.setModel("fsrcnn", 2)
    return processor


def upscale(data: bytes) -> bytes:
    image = open_image(data)
    if image.width * image.height > 12_000_000:
        raise ValueError("Upscaling is limited to images up to 12 megapixels.")
    frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("The image could not be decoded for upscaling.")
    result = super_resolution().upsample(frame)
    ok, encoded = cv2.imencode(".png", result, [cv2.IMWRITE_PNG_COMPRESSION, 6])
    if not ok:
        raise RuntimeError("The upscaled image could not be encoded.")
    return bytes(encoded)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "UP",
        "ocr": "tesseract",
        "languages": sorted(pytesseract.get_languages(config="")),
        "backgroundModel": (MODEL_DIR / "u2netp.onnx").exists(),
        "upscaleModel": (MODEL_DIR / "FSRCNN_x2.pb").exists(),
    }


@app.post("/process")
async def process(
    file: UploadFile = File(...),
    tool: str = Form(...),
    language: str = Form(DEFAULT_LANGUAGE),
    psm: int = Form(6),
    scale: int = Form(2),
):
    if tool not in ALLOWED_TOOLS:
        return error("Unknown image worker operation.")
    if scale != 2 and tool == "upscale":
        return error("The current super-resolution model supports 2× output only.")
    try:
        data = await file.read()
        image = open_image(data)
        if tool in {"ocr", "screenshot-to-text"}:
            if tool == "screenshot-to-text" and psm == 6:
                psm = 11
            return {"tool": tool, **ocr_image(image, language, psm)}
        if tool == "remove-background":
            output = remove_background(data)
            return Response(output, media_type="image/png", headers={"Content-Disposition": f'attachment; filename="{safe_name(file.filename or "image", "no-background.png")}"', "Cache-Control": "no-store"})
        output = upscale(data)
        return Response(output, media_type="image/png", headers={"Content-Disposition": f'attachment; filename="{safe_name(file.filename or "image", "upscaled.png")}"', "Cache-Control": "no-store"})
    except ValueError as exc:
        return error(str(exc))
    except RuntimeError as exc:
        return error(str(exc), 503)
    except Exception:
        return error("The local image worker could not process this file.", 500)
