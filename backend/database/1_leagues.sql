-- League identity, membership, join codes, and invitations.
CREATE TABLE IF NOT EXISTS challenger.leagues (
    id text PRIMARY KEY,
    name text NOT NULL CHECK (length(btrim(name)) > 0),
    max_members integer NOT NULL CHECK (max_members BETWEEN 2 AND 100),
    current_week integer NOT NULL CHECK (current_week > 0),
    draft_completed boolean NOT NULL DEFAULT false,
    draft_starts_at timestamptz,
    commissioner_user_id text NOT NULL,
    trade_reject_votes_required integer NOT NULL DEFAULT 2 CHECK (trade_reject_votes_required > 0),
    trade_review_hours integer NOT NULL DEFAULT 24 CHECK (trade_review_hours > 0)
);

CREATE TABLE IF NOT EXISTS challenger.league_memberships (
    league_id text NOT NULL REFERENCES challenger.leagues(id) ON DELETE CASCADE,
    user_id text NOT NULL,
    manager_name text NOT NULL,
    email text,
    team_name text NOT NULL,
    role text NOT NULL CHECK (role IN ('commissioner', 'member')),
    wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
    losses integer NOT NULL DEFAULT 0 CHECK (losses >= 0),
    ties integer NOT NULL DEFAULT 0 CHECK (ties >= 0),
    points_for numeric(12,2) NOT NULL DEFAULT 0,
    points_against numeric(12,2) NOT NULL DEFAULT 0,
    joined_at timestamptz NOT NULL,
    PRIMARY KEY (league_id, user_id),
    UNIQUE (league_id, team_name)
);

CREATE TABLE IF NOT EXISTS challenger.league_join_codes (
    code text PRIMARY KEY,
    league_id text NOT NULL UNIQUE REFERENCES challenger.leagues(id) ON DELETE CASCADE,
    CHECK (code = upper(code))
);

CREATE TABLE IF NOT EXISTS challenger.league_invitations (
    id text PRIMARY KEY,
    league_id text NOT NULL REFERENCES challenger.leagues(id) ON DELETE CASCADE,
    invited_by_user_id text NOT NULL,
    email text,
    token text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    accepted_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_memberships_user ON challenger.league_memberships(user_id);
CREATE INDEX IF NOT EXISTS ix_invitations_league ON challenger.league_invitations(league_id);
