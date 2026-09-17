-- error_message was varchar(255). A converter's rejection text (LibreOffice stderr for an
-- encrypted or damaged file) is routinely longer, so saving the FAILED status threw
-- "value too long for type character varying(255)" and left the job marked PROCESSING with no
-- worker on it. The maintenance task then re-queued it twice, ~15 minutes in all, before
-- recording the wrong reason ("did not complete in time"). text removes the length ceiling;
-- JobDispatcher also bounds what it stores.
ALTER TABLE jobs ALTER COLUMN error_message TYPE text;
