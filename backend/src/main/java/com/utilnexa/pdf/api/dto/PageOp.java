package com.utilnexa.pdf.api.dto;

/**
 * One entry in an organize plan. {@code sourceIndex} is required for SOURCE/SOURCE2, unused
 * (and may be null) for BLANK - boxed {@code Integer}, not {@code int}, so a BLANK entry's JSON
 * can simply omit it rather than needing a dummy value.
 */
public record PageOp(Kind kind, Integer sourceIndex, Integer rotation) {

  public enum Kind {
    SOURCE,
    SOURCE2,
    BLANK
  }
}
