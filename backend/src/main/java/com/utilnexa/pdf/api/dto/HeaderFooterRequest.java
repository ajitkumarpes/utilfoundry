package com.utilnexa.pdf.api.dto;

public record HeaderFooterRequest(
    HeaderFooterZone topLeft,
    HeaderFooterZone topCenter,
    HeaderFooterZone topRight,
    HeaderFooterZone bottomLeft,
    HeaderFooterZone bottomCenter,
    HeaderFooterZone bottomRight) {}
