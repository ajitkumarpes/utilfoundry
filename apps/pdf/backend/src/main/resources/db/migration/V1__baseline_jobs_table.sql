-- Baseline: mirrors the live schema Hibernate's ddl-auto:update had already created
-- (columns, types, and both CHECK constraints copied verbatim from `\d jobs` +
-- pg_get_constraintdef against the running dev database) so that baseline-on-migrate
-- can mark this version as already-satisfied on existing databases without producing
-- schema drift. jobs_type_check intentionally still lists PDF_TO_EXCEL here even though
-- JobType.java no longer declares it - that mismatch is real, pre-existing drift (Hibernate's
-- ddl-auto:update never narrows a CHECK constraint when an enum shrinks) and is corrected by
-- V2, which runs on every database, baselined or fresh, so both converge to the same schema.
CREATE TABLE jobs (
    id                 uuid PRIMARY KEY,
    type               varchar(255) NOT NULL,
    status             varchar(255) NOT NULL,
    input_key          varchar(255) NOT NULL,
    result_key         varchar(255),
    original_filename  varchar(255) NOT NULL,
    options            text,
    error_message      varchar(255),
    attempts           smallint NOT NULL,
    created_at         timestamp(6) with time zone NOT NULL,
    updated_at         timestamp(6) with time zone NOT NULL,
    CONSTRAINT jobs_status_check CHECK (status IN ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
    CONSTRAINT jobs_type_check CHECK (type IN ('OCR', 'WORD_TO_PDF', 'EXCEL_TO_PDF', 'PPT_TO_PDF', 'PDF_TO_WORD', 'PDF_TO_EXCEL', 'PDF_TO_PPT'))
);
