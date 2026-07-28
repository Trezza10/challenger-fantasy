-- A roster belongs to one league membership; slots point to canonical players.
CREATE TABLE IF NOT EXISTS challenger.rosters (
    league_id text NOT NULL,
    user_id text NOT NULL,
    PRIMARY KEY (league_id, user_id),
    FOREIGN KEY (league_id, user_id)
        REFERENCES challenger.league_memberships(league_id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS challenger.roster_slots (
    id text NOT NULL,
    league_id text NOT NULL,
    user_id text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('starter','bench')),
    position text NOT NULL CHECK (position IN ('QB','RB','WR','TE','FLEX','DEF','K','COACH')),
    player_id text NOT NULL REFERENCES challenger.players(id) ON DELETE RESTRICT,
    ordinal integer NOT NULL CHECK (ordinal >= 0),
    PRIMARY KEY (league_id, user_id, id),
    UNIQUE (league_id, user_id, player_id),
    UNIQUE (league_id, user_id, kind, ordinal),
    FOREIGN KEY (league_id, user_id)
        REFERENCES challenger.rosters(league_id, user_id) ON DELETE CASCADE
);
