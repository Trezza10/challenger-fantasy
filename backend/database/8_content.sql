-- User-facing content. Image payloads are text for compatibility, but production
-- should store object-storage URLs here instead of large base64 data URLs.
CREATE TABLE IF NOT EXISTS challenger.news_stories (
    id text PRIMARY KEY,
    category text NOT NULL,
    title text NOT NULL,
    summary text NOT NULL,
    body text NOT NULL,
    published_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS challenger.league_posts (
    id text PRIMARY KEY,
    league_id text NOT NULL REFERENCES challenger.leagues(id) ON DELETE CASCADE,
    user_id text NOT NULL,
    author_name text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    image_data_url text,
    image_position text CHECK (image_position IS NULL OR image_position IN ('top','bottom')),
    created_at timestamptz NOT NULL,
    FOREIGN KEY (league_id, user_id)
        REFERENCES challenger.league_memberships(league_id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS challenger.chat_messages (
    id text PRIMARY KEY,
    league_id text NOT NULL REFERENCES challenger.leagues(id) ON DELETE CASCADE,
    user_id text NOT NULL,
    sender text NOT NULL,
    message_text text NOT NULL,
    sent_at timestamptz NOT NULL,
    FOREIGN KEY (league_id, user_id)
        REFERENCES challenger.league_memberships(league_id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS challenger.activity_entries (
    id text PRIMARY KEY,
    league_id text NOT NULL REFERENCES challenger.leagues(id) ON DELETE CASCADE,
    actor text NOT NULL,
    summary text NOT NULL,
    activity_type text NOT NULL CHECK (activity_type IN ('Card','Lineup','Trade','Waiver')),
    occurred_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_posts_league_created ON challenger.league_posts(league_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_messages_league_sent ON challenger.chat_messages(league_id, sent_at);
CREATE INDEX IF NOT EXISTS ix_activities_league_time ON challenger.activity_entries(league_id, occurred_at DESC);
