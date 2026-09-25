FROM python:3.11-slim

# The models are downloaded at build time, so pin exactly which bytes: a fixed commit rather
# than a branch, and a checksum that fails the build if the file ever changes underneath us.
ARG FSRCNN_COMMIT=6a4812c4ef1c4f5947d79beafa32a05a6eb4a94d
ARG FSRCNN_SHA256=366b33f0084c7b3f2bf6724f0a2c77bca94fcec9d7b6d72389d330073b380d5c
ARG U2NETP_SHA256=309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8

# MALLOC_MMAP_THRESHOLD_: glibc otherwise raises its mmap threshold after the first large
# free, so later image buffers come from the heap and stay resident. Measured under the 768 MB
# limit, ten large jobs back to back left ~480 MB resident with the default and ~105 MB with this.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MALLOC_MMAP_THRESHOLD_=131072 \
    TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      libglib2.0-0 \
      libgl1 \
      tesseract-ocr \
      tesseract-ocr-eng \
      tesseract-ocr-deu \
      tesseract-ocr-fra \
      tesseract-ocr-hin \
      tesseract-ocr-spa \
      wget \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /models \
    && wget -q -O /models/FSRCNN_x2.pb "https://github.com/Saafke/FSRCNN_Tensorflow/raw/${FSRCNN_COMMIT}/models/FSRCNN_x2.pb" \
    && wget -q -O /models/u2netp.onnx https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx \
    && printf '%s  %s\n' \
      "${FSRCNN_SHA256}" /models/FSRCNN_x2.pb \
      "${U2NETP_SHA256}" /models/u2netp.onnx \
      | sha256sum -c -

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py ./

RUN useradd --create-home --uid 10001 worker \
    && chown -R worker:worker /app /models
USER worker

EXPOSE 8094
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8094", "--workers", "1"]
