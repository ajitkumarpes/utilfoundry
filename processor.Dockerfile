FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    libreoffice \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    ca-certificates \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
CMD ["sleep","infinity"]
