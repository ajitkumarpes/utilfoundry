import io
import unittest

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


if __name__ == "__main__":
    unittest.main()
