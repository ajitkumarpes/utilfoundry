from __future__ import annotations

import asyncio
import io
import os
import re
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
import pytesseract
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.concurrency import run_in_threadpool
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
UPSCALE_FACTORS = {2, 4, 8}
MAX_UPSCALE_OUTPUT_PIXELS = 48_000_000
# How many images are worked on at once. The work runs on a thread (below), so without a cap
# every queued request would be decoded in parallel; one at a time keeps memory what the
# container was sized for, while the event loop stays free to answer /health.
WORKER_CONCURRENCY = max(1, int(os.getenv("WORKER_CONCURRENCY", "1")))
_slots = asyncio.Semaphore(WORKER_CONCURRENCY)

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


def resolve_language(language: str) -> str:
    """`auto` means "assume Latin script"; Tesseract has no true language detector."""
    if language in {"", "auto"}:
        return DEFAULT_LANGUAGE
    return language


def ocr_image(image: Image.Image, language: str, psm: int) -> dict[str, object]:
    language = resolve_language(language)
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
    # Dark-mode screenshots and posters put light text on a dark ground, which
    # Tesseract reads poorly; inverting first is the standard remedy.
    if float(np.asarray(prepared).mean()) < 110:
        prepared = ImageOps.invert(prepared)
    config = f"--oem 3 --psm {psm}"
    text = pytesseract.image_to_string(prepared, lang=language, config=config, timeout=25).strip()
    data = pytesseract.image_to_data(prepared, lang=language, config=config, output_type=Output.DICT, timeout=25)
    confidences = [float(value) for value in data["conf"] if value and float(value) >= 0]
    confidence = round(sum(confidences) / len(confidences), 1) if confidences else None
    return {"text": text, "confidence": confidence, "language": language, "width": image.width, "height": image.height}


# u2netp, run directly on onnxruntime. rembg wraps the same model, but importing it pulls in
# scipy, scikit-image and a JIT compiler: 20 s and ~400 MB before any work, which with the
# work itself took the worker past its 768 MB limit on an ordinary 12 MP photo. These steps
# are rembg 2.0.67's (u2netp session + post_process_mask + naive_cutout), unchanged.
BACKGROUND_INPUT = (320, 320)
BACKGROUND_MEAN = np.array([0.485, 0.456, 0.406])
BACKGROUND_STD = np.array([0.229, 0.224, 0.225])
MASK_KERNEL = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))


@lru_cache(maxsize=1)
def background_session():
    import onnxruntime

    model_path = MODEL_DIR / "u2netp.onnx"
    if not model_path.exists():
        raise RuntimeError("Background-removal model is not installed.")
    options = onnxruntime.SessionOptions()
    # u2netp needs ~400 MB of scratch space per run. The default arena keeps that for the life
    # of the process; without it the memory goes back after each run, at no measurable cost.
    options.enable_cpu_mem_arena = False
    return onnxruntime.InferenceSession(str(model_path), sess_options=options, providers=["CPUExecutionProvider"])


def background_mask(image: Image.Image) -> Image.Image:
    """A 0/255 mask of the subject, at the image's own size."""
    session = background_session()
    small = np.asarray(image.resize(BACKGROUND_INPUT, Image.Resampling.LANCZOS), dtype=np.float64)
    small = small / max(float(small.max()), 1e-6)
    tensor = ((small - BACKGROUND_MEAN) / BACKGROUND_STD).transpose(2, 0, 1)[np.newaxis].astype(np.float32)
    prediction = session.run(None, {session.get_inputs()[0].name: tensor})[0][0, 0]
    low, high = float(prediction.min()), float(prediction.max())
    prediction = (prediction - low) / (high - low) if high > low else np.zeros_like(prediction)
    mask = Image.fromarray((prediction * 255).astype(np.uint8), mode="L").resize(image.size, Image.Resampling.LANCZOS)
    # Smooth the edge: open away specks, blur, then back to a hard 0/255 cut (>= 127 kept).
    # In place, one byte per pixel throughout: at 40 MP a temporary 64-bit array alone is 320 MB.
    edge = np.array(mask)
    cv2.morphologyEx(edge, cv2.MORPH_OPEN, MASK_KERNEL, dst=edge)
    cv2.GaussianBlur(edge, (5, 5), sigmaX=2, sigmaY=2, dst=edge, borderType=cv2.BORDER_DEFAULT)
    cv2.threshold(edge, 126, 255, cv2.THRESH_BINARY, dst=edge)
    return Image.fromarray(edge, mode="L")


def remove_background(image: Image.Image) -> bytes:
    ImageOps.exif_transpose(image, in_place=True)
    rgb = image if image.mode == "RGB" else image.convert("RGB")
    mask = background_mask(rgb)
    cutout = Image.new("RGBA", rgb.size, 0)
    cutout.paste(rgb, None, mask)
    output = io.BytesIO()
    cutout.save(output, format="PNG")
    return output.getvalue()


@lru_cache(maxsize=1)
def super_resolution():
    model_path = MODEL_DIR / "FSRCNN_x2.pb"
    if not model_path.exists():
        raise RuntimeError("Upscaling model is not installed.")
    processor = cv2.dnn_superres.DnnSuperResImpl_create()
    processor.readModel(str(model_path))
    processor.setModel("fsrcnn", 2)
    return processor


# FSRCNN keeps 56 feature maps at the input's full size, so one pass over a whole photo needs
# gigabytes (1.2 GB for a 1 MP image, 2.9 GB for 3 MP). Tiles bound that to a few tens of MB;
# each tile is read with a margin wider than the network's receptive field, and only its
# centre is kept, so the result matches a single pass exactly.
UPSCALE_TILE = 256
UPSCALE_MARGIN = 16


def upsample_tiled(processor, frame: np.ndarray) -> np.ndarray:
    height, width = frame.shape[:2]
    output = np.empty((height * 2, width * 2, frame.shape[2]), dtype=frame.dtype)
    for top in range(0, height, UPSCALE_TILE):
        for left in range(0, width, UPSCALE_TILE):
            bottom, right = min(height, top + UPSCALE_TILE), min(width, left + UPSCALE_TILE)
            y0, x0 = max(0, top - UPSCALE_MARGIN), max(0, left - UPSCALE_MARGIN)
            y1, x1 = min(height, bottom + UPSCALE_MARGIN), min(width, right + UPSCALE_MARGIN)
            tile = processor.upsample(np.ascontiguousarray(frame[y0:y1, x0:x1]))
            oy, ox = (top - y0) * 2, (left - x0) * 2
            output[top * 2:bottom * 2, left * 2:right * 2] = tile[oy:oy + (bottom - top) * 2, ox:ox + (right - left) * 2]
    return output


def upscale(data: bytes, factor: int) -> bytes:
    """The FSRCNN model doubles an image, so 4x and 8x are two and three passes."""
    image = open_image(data)
    if image.width * image.height > 12_000_000:
        raise ValueError("Upscaling is limited to images up to 12 megapixels.")
    if image.width * image.height * factor * factor > MAX_UPSCALE_OUTPUT_PIXELS:
        raise ValueError(
            f"{factor}x would produce more than "
            f"{MAX_UPSCALE_OUTPUT_PIXELS // 1_000_000} megapixels. Choose a smaller factor."
        )
    frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("The image could not be decoded for upscaling.")

    processor = super_resolution()
    passes = {2: 1, 4: 2, 8: 3}[factor]
    for _ in range(passes):
        frame = upsample_tiled(processor, frame)

    ok, encoded = cv2.imencode(".png", frame, [cv2.IMWRITE_PNG_COMPRESSION, 6])
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
        "upscaleFactors": sorted(UPSCALE_FACTORS),
    }


@app.post("/process")
async def process(
    file: UploadFile = File(...),
    tool: str = Form(...),
    language: str = Form("auto"),
    psm: int = Form(6),
    scale: int = Form(2),
):
    if tool not in ALLOWED_TOOLS:
        return error("Unknown image worker operation.")
    if tool == "upscale" and scale not in UPSCALE_FACTORS:
        return error("Choose a 2x, 4x or 8x upscale factor.")
    data = await file.read()
    # OCR, the background model and upscaling each block for seconds. Run directly in this
    # async handler they would stall the event loop, so health checks time out mid-job.
    async with _slots:
        return await run_in_threadpool(run_tool, tool, data, file.filename or "image", language, psm, scale)


def run_tool(tool: str, data: bytes, filename: str, language: str, psm: int, scale: int):
    try:
        image = open_image(data)
        if tool in {"ocr", "screenshot-to-text"}:
            if tool == "screenshot-to-text" and psm == 6:
                psm = 11
            return {"tool": tool, **ocr_image(image, language, psm)}
        if tool == "remove-background":
            output = remove_background(image)
            return Response(output, media_type="image/png", headers={"Content-Disposition": f'attachment; filename="{safe_name(filename, "no-background.png")}"', "Cache-Control": "no-store"})
        output = upscale(data, scale)
        return Response(output, media_type="image/png", headers={"Content-Disposition": f'attachment; filename="{safe_name(filename, "upscaled.png")}"', "Cache-Control": "no-store"})
    except ValueError as exc:
        return error(str(exc))
    except RuntimeError as exc:
        return error(str(exc), 503)
    except Exception:
        return error("The local image worker could not process this file.", 500)
