-- Matchup sides, paired players, and card plays are normalized child rows.
CREATE TABLE IF NOT EXISTS challenger.matchups (
    id text PRIMARY KEY,
    league_id text NOT NULL UNIQUE REFERENCES challenger.leagues(id) ON DELETE CASCADE,
    week integer NOT NULL CHECK (week > 0),
    game_time text NOT NULL,
    is_live boolean NOT NULL,
    win_chance integer NOT NULL CHECK (win_chance BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS challenger.matchup_teams (
    matchup_id text NOT NULL REFERENCES challenger.matchups(id) ON DELETE CASCADE,
    side text NOT NULL CHECK (side IN ('left','right')),
    team_id text NOT NULL,
    name text NOT NULL,
    score numeric(12,2) NOT NULL,
    projected_points numeric(12,2) NOT NULL,
    PRIMARY KEY (matchup_id, side)
);

CREATE TABLE IF NOT EXISTS challenger.matchup_team_cards (
    matchup_id text NOT NULL,
    side text NOT NULL,
    card_id text NOT NULL REFERENCES challenger.power_cards(id) ON DELETE RESTRICT,
    quantity integer NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (matchup_id, side, card_id),
    FOREIGN KEY (matchup_id, side)
        REFERENCES challenger.matchup_teams(matchup_id, side) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS challenger.player_matchups (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    matchup_id text NOT NULL REFERENCES challenger.matchups(id) ON DELETE CASCADE,
    lineup_group text NOT NULL CHECK (lineup_group IN ('starter','bench')),
    ordinal integer NOT NULL CHECK (ordinal >= 0),
    left_player_id text NOT NULL REFERENCES challenger.players(id) ON DELETE RESTRICT,
    right_player_id text NOT NULL REFERENCES challenger.players(id) ON DELETE RESTRICT,
    UNIQUE (matchup_id, lineup_group, ordinal)
);

CREATE TABLE IF NOT EXISTS challenger.applied_cards (
    id text PRIMARY KEY,
    matchup_id text NOT NULL REFERENCES challenger.matchups(id) ON DELETE CASCADE,
    player_id text NOT NULL REFERENCES challenger.players(id) ON DELETE RESTRICT,
    player_name text NOT NULL,
    played_by_user_id text NOT NULL,
    played_by_name text NOT NULL,
    played_by text NOT NULL,
    card_id text NOT NULL REFERENCES challenger.power_cards(id) ON DELETE RESTRICT
);
