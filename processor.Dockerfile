FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    libreoffice \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-hin \
    poppler-utils \
    qpdf \
    python3 \
    python3-venv \
    ca-certificates \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
RUN pip install --no-cache-dir \
    "fastapi>=0.115" \
    "uvicorn[standard]>=0.34" \
    "python-multipart>=0.0.9" \
    "ocrmypdf>=16.0"

WORKDIR /workspace
COPY processor/app.py /app/app.py

EXPOSE 8000
CMD ["uvicorn", "app:app", "--app-dir", "/app", "--host", "0.0.0.0", "--port", "8000"]
