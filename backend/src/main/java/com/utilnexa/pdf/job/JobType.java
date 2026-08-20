package com.utilnexa.pdf.job;

public enum JobType {
  OCR,
  WORD_TO_PDF,
  EXCEL_TO_PDF,
  PPT_TO_PDF,
  PDF_TO_WORD,
  // No PDF_TO_EXCEL: LibreOffice has no PDF-import path into Calc (confirmed - no
  // calc_pdf_import filter is registered, and forcing it crashes soffice). Would need a
  // genuinely different approach (table extraction, not a format conversion) - out of scope.
  PDF_TO_PPT;

  public String targetFormat() {
    return switch (this) {
      case WORD_TO_PDF, EXCEL_TO_PDF, PPT_TO_PDF -> "pdf";
      case PDF_TO_WORD -> "docx";
      case PDF_TO_PPT -> "pptx";
      case OCR -> throw new IllegalStateException("OCR has no target format.");
    };
  }
}
