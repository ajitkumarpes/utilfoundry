package com.utilnexa.pdf.api.dto;

/**
 * One of the 6 header/footer positions on a page. {@code type} is one of NONE, TEXT, PAGE_NUMBER,
 * DATE, BATES. {@code text} is used by TEXT; {@code batesPrefix}/{@code batesDigits}/
 * {@code batesStart} are used by BATES. Unused fields for a given type are simply ignored.
 */
public record HeaderFooterZone(
    String type, String text, String batesPrefix, Integer batesDigits, Integer batesStart) {}
