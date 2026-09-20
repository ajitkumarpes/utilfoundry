-- Feedback submitted from the widget on web, developer, images and pdf. `id` is
-- generated app-side (crypto.randomUUID()), same as PDF's Java backend generates its
-- job ids app-side rather than via a SQL default.
CREATE TABLE feedback (
    id               uuid PRIMARY KEY,
    app              varchar(32) NOT NULL,
    tool_id          varchar(128),
    tool_name        varchar(255),
    category         varchar(32) NOT NULL,
    rating           smallint,
    message          text,
    page_url         text NOT NULL,
    user_agent       text,
    status           varchar(16) NOT NULL DEFAULT 'new',
    created_at       timestamp(6) with time zone NOT NULL DEFAULT now(),
    CONSTRAINT feedback_app_check CHECK (app IN ('web', 'developer', 'images', 'pdf')),
    CONSTRAINT feedback_category_check CHECK (category IN ('general', 'feature_request', 'issue', 'thanks')),
    CONSTRAINT feedback_rating_check CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
    CONSTRAINT feedback_status_check CHECK (status IN ('new', 'reviewed'))
);

CREATE INDEX feedback_created_at_idx ON feedback (created_at DESC);
CREATE INDEX feedback_app_idx ON feedback (app);

-- Anonymous page-view beacons. No raw IP address is stored anywhere here — only the
-- country/region/city a local GeoIP lookup resolves it to, so visitor location never
-- depends on sending an address to a third party. `visitor_id` is a random id minted
-- and read back via a first-party cookie on this service's own origin, used only to
-- tell a repeat visit from a new one.
CREATE TABLE visits (
    id               uuid PRIMARY KEY,
    app              varchar(32) NOT NULL,
    path             text NOT NULL,
    visitor_id       uuid NOT NULL,
    country          varchar(2),
    region           varchar(128),
    city             varchar(128),
    referrer         text,
    user_agent       text,
    created_at       timestamp(6) with time zone NOT NULL DEFAULT now(),
    CONSTRAINT visits_app_check CHECK (app IN ('web', 'developer', 'images', 'pdf'))
);

CREATE INDEX visits_created_at_idx ON visits (created_at DESC);
CREATE INDEX visits_visitor_id_idx ON visits (visitor_id);
CREATE INDEX visits_country_idx ON visits (country);
