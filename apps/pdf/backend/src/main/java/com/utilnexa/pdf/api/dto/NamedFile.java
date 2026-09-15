package com.utilnexa.pdf.api.dto;

public record NamedFile(String filename, byte[] content, String contentType) {}
