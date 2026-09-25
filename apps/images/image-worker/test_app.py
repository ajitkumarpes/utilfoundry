"""
Drives the worker in-process. The OCR engine and the models are replaced where a test is
about the service around them (validation, responsiveness), so these run without Tesseract
or the model files; the real engines are exercised by the images app's browser suite.
"""

import asyncio
import io
import time
import unittest
from unittest import mock

import httpx
from PIL import Image

import app


def png(width: int = 40, height: int = 30) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (200, 30, 30)).save(buffer, format="PNG")
    return buffer.getvalue()


class WorkerTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app.app), base_url="http://worker")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def process(self, tool: str, data: bytes = b"", **fields):
        return await self.client.post(
            "/process",
            files={"file": ("photo.png", data or png())},
            data={"tool": tool, **{key: str(value) for key, value in fields.items()}},
        )

    async def test_refuses_an_unknown_operation(self):
        response = await self.process("format-disk")
        self.assertEqual(400, response.status_code)
        self.assertEqual("Unknown image worker operation.", response.json()["error"])

    async def test_refuses_an_upscale_factor_it_does_not_offer(self):
        response = await self.process("upscale", scale=3)
        self.assertEqual(400, response.status_code)

    async def test_refuses_a_file_that_is_not_an_image(self):
        response = await self.process("ocr", b"%PDF-1.7 not an image")
        self.assertEqual(400, response.status_code)
        self.assertEqual("The file is not a supported image.", response.json()["error"])

    async def test_refuses_dimensions_too_large_to_process_safely(self):
        with mock.patch.object(app, "MAX_PIXELS", 100):
            response = await self.process("ocr")
        self.assertEqual(400, response.status_code)
        self.assertIn("too large", response.json()["error"])

    async def test_refuses_an_ocr_language_that_is_not_a_plain_code(self):
        # Checked before anything reaches Tesseract's command line.
        for language in ["../../etc/passwd", "eng --psm 0", "EN", "eng+"]:
            response = await self.process("ocr", language=language)
            self.assertEqual(400, response.status_code, language)
            self.assertEqual("Choose a supported OCR language code.", response.json()["error"])

    async def test_refuses_a_page_layout_mode_outside_the_list(self):
        with mock.patch.object(app.pytesseract, "get_languages", return_value=["eng"]):
            response = await self.process("ocr", language="eng", psm=0)
        self.assertEqual(400, response.status_code)
        self.assertEqual("Choose a supported OCR page layout mode.", response.json()["error"])

    async def test_refuses_an_upscale_that_would_be_too_large(self):
        with mock.patch.object(app, "MAX_UPSCALE_OUTPUT_PIXELS", 1000):
            response = await self.process("upscale", scale=8)
        self.assertEqual(400, response.status_code)
        self.assertIn("megapixels", response.json()["error"])

    async def test_health_answers_while_an_image_is_being_worked_on(self):
        def slow_ocr(image, language, psm):
            time.sleep(1.5)
            return {"text": "hello", "confidence": 90.0, "language": "eng", "width": image.width, "height": image.height}

        with mock.patch.object(app, "ocr_image", side_effect=slow_ocr):
            job = asyncio.create_task(self.process("ocr"))
            await asyncio.sleep(0.3)
            started = time.monotonic()
            health = await self.client.get("/health")
            answered_in = time.monotonic() - started
            self.assertEqual(200, health.status_code)
            self.assertLess(answered_in, 0.5, "the health check waited for the job")
            self.assertFalse(job.done(), "the job finished before the health check ran")
            response = await job
        self.assertEqual("hello", response.json()["text"])

    async def test_works_on_one_image_at_a_time(self):
        running = 0
        peak = 0

        def counting_ocr(image, language, psm):
            nonlocal running, peak
            running += 1
            peak = max(peak, running)
            time.sleep(0.3)
            running -= 1
            return {"text": "", "confidence": None, "language": "eng", "width": 1, "height": 1}

        with mock.patch.object(app, "ocr_image", side_effect=counting_ocr):
            responses = await asyncio.gather(*(self.process("ocr") for _ in range(3)))
        self.assertEqual([200, 200, 200], [response.status_code for response in responses])
        self.assertEqual(1, peak)


@unittest.skipUnless((app.MODEL_DIR / "FSRCNN_x2.pb").exists(), "needs the models in the worker image")
class ModelTest(unittest.TestCase):
    """The real models, as installed in the image (CI runs these inside it)."""

    def test_tiled_upscaling_matches_a_single_pass(self):
        import numpy as np

        rng = np.random.default_rng(7)
        frame = rng.integers(0, 256, size=(300, 530, 3), dtype=np.uint8)
        processor = app.super_resolution()
        tiled = app.upsample_tiled(processor, frame)
        whole = processor.upsample(frame)
        self.assertEqual(whole.shape, tiled.shape)
        # Identical but for float rounding in the network: at most one level, almost nowhere.
        difference = np.abs(whole.astype(int) - tiled.astype(int))
        self.assertLessEqual(int(difference.max()), 1)
        self.assertLess(float((difference > 0).mean()), 0.001)

    def test_background_mask_is_a_hard_cut_at_full_size(self):
        import numpy as np

        image = Image.new("RGB", (640, 480), (230, 230, 230))
        image.paste((40, 90, 40), (200, 120, 440, 360))
        mask = app.background_mask(image)
        self.assertEqual(image.size, mask.size)
        self.assertEqual({0, 255}, set(np.unique(np.asarray(mask)).tolist()))

    def test_background_removal_keeps_the_subject_and_clears_the_rest(self):
        image = Image.new("RGB", (640, 480), (230, 230, 230))
        image.paste((40, 90, 40), (200, 120, 440, 360))
        cutout = Image.open(io.BytesIO(app.remove_background(image)))
        self.assertEqual("RGBA", cutout.mode)
        self.assertEqual(255, cutout.getpixel((320, 240))[3])
        self.assertEqual(0, cutout.getpixel((10, 10))[3])


if __name__ == "__main__":
    unittest.main()
