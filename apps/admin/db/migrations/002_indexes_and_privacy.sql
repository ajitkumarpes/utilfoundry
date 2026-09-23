-- The feedback inbox filters by status and sorts by date on every load.
CREATE INDEX IF NOT EXISTS feedback_status_created_at_idx ON feedback (status, created_at DESC);

-- Visits now keep only the referring site's host and a path without its query string,
-- because both can carry personal data (search terms, tokens, e-mail addresses). Rows
-- recorded before that change are brought into line here.
UPDATE visits
SET referrer = regexp_replace(substring(referrer FROM '^https?://([^/:?#]+)'), '^www\.', '')
WHERE referrer ~ '^https?://';

UPDATE visits SET referrer = NULL WHERE referrer IS NOT NULL AND referrer !~ '^[A-Za-z0-9.-]+$';

UPDATE visits
SET path = split_part(split_part(path, '?', 1), '#', 1)
WHERE path ~ '[?#]';

CREATE INDEX IF NOT EXISTS visits_created_at_app_idx ON visits (created_at DESC, app);
