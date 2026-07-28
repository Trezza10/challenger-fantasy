-- Draft picks and waiver claims are append-oriented league transactions.
CREATE TABLE IF NOT EXISTS challenger.draft_picks (
    id text PRIMARY KEY,
    league_id text NOT NULL REFERENCES challenger.leagues(id) ON DELETE CASCADE,
    team_user_id text NOT NULL,
    player_id text NOT NULL REFERENCES challenger.players(id) ON DELETE RESTRICT,
    round integer NOT NULL CHECK (round > 0),
    overall_pick integer NOT NULL CHECK (overall_pick > 0),
    picked_at timestamptz NOT NULL,
    UNIQUE (league_id, player_id),
    UNIQUE (league_id, overall_pick),
    FOREIGN KEY (league_id, team_user_id)
        REFERENCES challenger.league_memberships(league_id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS challenger.waiver_claims (
    id text PRIMARY KEY,
    league_id text NOT NULL REFERENCES challenger.leagues(id) ON DELETE CASCADE,
    user_id text NOT NULL,
    add_player_id text NOT NULL REFERENCES challenger.players(id) ON DELETE RESTRICT,
    drop_player_id text REFERENCES challenger.players(id) ON DELETE RESTRICT,
    priority integer NOT NULL CHECK (priority > 0),
    status text NOT NULL CHECK (status IN ('Pending','Won','Lost','Cancelled')),
    created_at timestamptz NOT NULL,
    FOREIGN KEY (league_id, user_id)
        REFERENCES challenger.league_memberships(league_id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_waivers_league_status
    ON challenger.waiver_claims(league_id, status, priority);
