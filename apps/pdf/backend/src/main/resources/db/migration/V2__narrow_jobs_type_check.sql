-- Removes PDF_TO_EXCEL from jobs_type_check. JobType.java dropped that constant (see its
-- comment: LibreOffice has no PDF-import path into Calc) but ddl-auto:update, which owned
-- this table before V1, never narrows an existing CHECK constraint - only Hibernate's own
-- create-from-scratch path would have produced the narrower list, and update never re-runs
-- that path against a table that already exists. Confirmed zero live rows use the value
-- before writing this migration (SELECT type, count(*) FROM jobs GROUP BY type - 0 rows
-- total), so there is nothing for the new, stricter constraint to reject.
ALTER TABLE jobs DROP CONSTRAINT jobs_type_check;

ALTER TABLE jobs ADD CONSTRAINT jobs_type_check
    CHECK (type IN ('OCR', 'WORD_TO_PDF', 'EXCEL_TO_PDF', 'PPT_TO_PDF', 'PDF_TO_WORD', 'PDF_TO_PPT'));
