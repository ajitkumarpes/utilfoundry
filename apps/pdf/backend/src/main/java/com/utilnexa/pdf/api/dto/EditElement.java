package com.utilnexa.pdf.api.dto;

import java.util.List;

/**
 * One placed element in a free-form PDF edit, from the canvas editor at /tools/edit-pdf. A single
 * record with nullable per-type fields (same shape as {@link PageOp}), rather than one record per
 * type, because Jackson has no polymorphism configured anywhere in this codebase and every field
 * here is either a primitive placement or a short scalar — introducing a sealed-interface +
 * `@JsonTypeInfo` setup for eight variants would be more machinery than the data warrants.
 *
 * <p>{@code xPct}/{@code yPct} are the box's top-left corner as a fraction of the page (top-left
 * origin, matching {@link SignPlacement} and {@link RedactionArea}); {@code widthPct}/{@code
 * heightPct} size it the same way, before {@code rotationDeg} turns the box around its own
 * center. ANNOTATE ignores the box and uses {@code points} instead — a freehand stroke has no
 * natural bounding box the user drew.
 */
public record EditElement(
    Kind kind,
    int pageIndex,
    float xPct,
    float yPct,
    float widthPct,
    float heightPct,
    // Every kind except ANNOTATE: degrees clockwise around the box's center; null/0 = upright.
    Float rotationDeg,
    // Every kind except ANNOTATE: 0-1, null = fully opaque.
    Float opacity,
    // TEXT
    String text,
    Float fontSize,
    String color,
    // IMAGE, SIGN: index into the "images" part of the request
    Integer imageRef,
    // SHAPE
    ShapeKind shapeKind,
    Float strokeWidth,
    Boolean filled,
    // SHAPE with shapeKind=LINE or ARROW only: false (default) draws from the box's top-left
    // corner to its bottom-right, true from bottom-left to top-right - which corners the user
    // actually dragged between, since the box alone (always normalized to positive width/height)
    // loses that direction.
    Boolean flipped,
    // LINK
    String url,
    // FORM_FIELD
    FieldKind fieldKind,
    String fieldName,
    // FORM_FIELD with fieldKind=TEXT_FIELD only.
    Boolean multiline,
    // FORM_FIELD with fieldKind=RADIO only: this option's export value, and every element sharing
    // the same fieldName forms one radio group - see PdfEditService for how they're merged.
    String optionValue,
    // FORM_FIELD with fieldKind=RADIO or CHECKBOX only: whether this starts selected/checked.
    Boolean checked,
    // FORM_FIELD with fieldKind=DROPDOWN only.
    List<String> options,
    // ANNOTATE: a freehand stroke, page-relative points in drawing order
    List<EditPoint> points) {

  public enum Kind {
    TEXT,
    IMAGE,
    SIGN,
    SHAPE,
    WHITEOUT,
    LINK,
    FORM_FIELD,
    ANNOTATE
  }

  public enum ShapeKind {
    RECTANGLE,
    LINE,
    ELLIPSE,
    ARROW,
    // Quick "stamp" marks - drawn as vector paths rather than a text glyph, so there is no font
    // coverage to worry about for the ✕/✓ characters.
    X_MARK,
    CHECK
  }

  public enum FieldKind {
    TEXT_FIELD,
    CHECKBOX,
    RADIO,
    DROPDOWN
  }
}
