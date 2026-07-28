-- NFL player data and its repeating stat/history children. No JSON is needed.
CREATE TABLE IF NOT EXISTS challenger.players (
    id text PRIMARY KEY,
    name text NOT NULL,
    position text NOT NULL CHECK (position IN ('QB','RB','WR','TE','FLEX','DEF','K','COACH')),
    nfl_team text NOT NULL,
    score numeric(12,2) NOT NULL DEFAULT 0,
    card_adjustment numeric(12,2) NOT NULL DEFAULT 0,
    game_started boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS challenger.player_stats (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    player_id text NOT NULL REFERENCES challenger.players(id) ON DELETE CASCADE,
    stat_group text NOT NULL CHECK (stat_group IN ('live','recent')),
    ordinal integer NOT NULL CHECK (ordinal >= 0),
    label text NOT NULL,
    value text NOT NULL,
    UNIQUE (player_id, stat_group, ordinal)
);

CREATE TABLE IF NOT EXISTS challenger.player_score_breakdowns (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    player_id text NOT NULL REFERENCES challenger.players(id) ON DELETE CASCADE,
    ordinal integer NOT NULL CHECK (ordinal >= 0),
    label text NOT NULL,
    quantity numeric(14,4) NOT NULL,
    points_per_unit numeric(14,4) NOT NULL,
    points numeric(14,4) NOT NULL,
    UNIQUE (player_id, ordinal)
);

CREATE TABLE IF NOT EXISTS challenger.player_week_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    player_id text NOT NULL REFERENCES challenger.players(id) ON DELETE CASCADE,
    week integer NOT NULL CHECK (week > 0),
    opponent text NOT NULL,
    stat_line text NOT NULL,
    base_points numeric(12,2) NOT NULL,
    card_adjustment numeric(12,2) NOT NULL DEFAULT 0,
    UNIQUE (player_id, week)
);
