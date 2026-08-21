package com.utilnexa.pdf.api.dto;

public record SanitizeScanResult(
    boolean hasMetadata, int attachmentCount, int annotationCount, boolean hasScripts, int linkCount) {}
