import asyncio
import io
import subprocess
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

import httpx
from fastapi import HTTPException, UploadFile

import app


class ProcessorBoundaryTest(unittest.IsolatedAsyncioTestCase):
    def test_rejects_missing_internal_token(self):
        with self.assertRaises(HTTPException) as raised:
            app._require_processor_token(None)
        self.assertEqual(401, raised.exception.status_code)

    async def test_rejects_empty_upload(self):
        upload = UploadFile(filename="empty.pdf", file=io.BytesIO(b""))
        with self.assertRaises(HTTPException) as raised:
            await app._read_limited_upload(upload)
        self.assertEqual(400, raised.exception.status_code)

    async def test_enforces_limit_while_streaming(self):
        original_limit = app.MAX_UPLOAD_BYTES
        app.MAX_UPLOAD_BYTES = 4
        try:
            upload = UploadFile(filename="large.pdf", file=io.BytesIO(b"12345"))
            with self.assertRaises(HTTPException) as raised:
                await app._read_limited_upload(upload)
            self.assertEqual(413, raised.exception.status_code)
        finally:
            app.MAX_UPLOAD_BYTES = original_limit


def _slow_tool(argv, **_kwargs):
    """Stands in for ocrmypdf/soffice: takes a while, then writes the output they would."""
    time.sleep(1.5)
    if argv[0] == "ocrmypdf":
        Path(argv[-1]).write_bytes(b"%PDF-ocr")
    else:
        outdir = Path(argv[argv.index("--outdir") + 1])
        target = argv[argv.index("--convert-to") + 1].split(":")[0]
        outdir.joinpath(f"{Path(argv[-1]).stem}.{target}").write_bytes(b"converted")
    return subprocess.CompletedProcess(argv, 0, b"", b"")


class ProcessorConcurrencyTest(unittest.IsolatedAsyncioTestCase):
    """A long job must not stall the server: the health check has to keep answering."""

    async def asyncSetUp(self):
        self.workspace = tempfile.TemporaryDirectory()
        self.patches = [
            mock.patch.object(app, "WORKSPACE", self.workspace.name),
            mock.patch.object(app.subprocess, "run", side_effect=_slow_tool),
        ]
        for patch in self.patches:
            patch.start()
        transport = httpx.ASGITransport(app=app.app)
        self.client = httpx.AsyncClient(transport=transport, base_url="http://processor")

    async def asyncTearDown(self):
        await self.client.aclose()
        for patch in self.patches:
            patch.stop()
        self.workspace.cleanup()

    async def _health_while(self, job):
        task = asyncio.create_task(job)
        await asyncio.sleep(0.3)
        started = time.monotonic()
        health = await self.client.get("/health")
        answered_in = time.monotonic() - started
        self.assertEqual(200, health.status_code)
        self.assertLess(answered_in, 0.5, "the health check waited for the job")
        self.assertFalse(task.done(), "the job finished before the health check ran")
        return await task

    async def test_health_answers_during_ocr(self):
        response = await self._health_while(self.client.post(
            "/process/ocr",
            files={"file": ("scan.pdf", b"%PDF-1.4")},
            data={"language": "eng"},
            headers={"x-processor-token": app.PROCESSOR_TOKEN},
        ))
        self.assertEqual(200, response.status_code)
        self.assertEqual(b"%PDF-ocr", response.content)

    async def test_health_answers_during_office_conversion(self):
        response = await self._health_while(self.client.post(
            "/process/office-convert",
            files={"file": ("letter.docx", b"PK..")},
            data={"target_format": "pdf"},
            headers={"x-processor-token": app.PROCESSOR_TOKEN},
        ))
        self.assertEqual(200, response.status_code)
        self.assertEqual(b"converted", response.content)


if __name__ == "__main__":
    unittest.main()
