FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    U2NET_HOME=/models \
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
    && wget -q -O /models/FSRCNN_x2.pb https://github.com/Saafke/FSRCNN_Tensorflow/raw/master/models/FSRCNN_x2.pb \
    && wget -q -O /models/u2netp.onnx https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py ./

RUN useradd --create-home --uid 10001 worker \
    && chown -R worker:worker /app /models
USER worker

EXPOSE 8094
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8094", "--workers", "1"]
