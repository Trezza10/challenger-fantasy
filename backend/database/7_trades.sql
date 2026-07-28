-- A trade is one row; requested/offered assets and votes are relational children.
CREATE TABLE IF NOT EXISTS challenger.trade_offers (
    id text PRIMARY KEY,
    league_id text NOT NULL REFERENCES challenger.leagues(id) ON DELETE CASCADE,
    from_user_id text NOT NULL,
    to_user_id text NOT NULL,
    status text NOT NULL CHECK (status IN ('Pending','LeagueReview','Accepted','Rejected','Cancelled')),
    created_at timestamptz NOT NULL,
    review_ends_at timestamptz,
    CHECK (from_user_id <> to_user_id),
    FOREIGN KEY (league_id, from_user_id)
        REFERENCES challenger.league_memberships(league_id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (league_id, to_user_id)
        REFERENCES challenger.league_memberships(league_id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS challenger.trade_player_assets (
    trade_id text NOT NULL REFERENCES challenger.trade_offers(id) ON DELETE CASCADE,
    direction text NOT NULL CHECK (direction IN ('offered','requested')),
    player_id text NOT NULL REFERENCES challenger.players(id) ON DELETE RESTRICT,
    PRIMARY KEY (trade_id, direction, player_id)
);

CREATE TABLE IF NOT EXISTS challenger.trade_card_assets (
    trade_id text NOT NULL REFERENCES challenger.trade_offers(id) ON DELETE CASCADE,
    direction text NOT NULL CHECK (direction IN ('offered','requested')),
    card_id text NOT NULL REFERENCES challenger.power_cards(id) ON DELETE RESTRICT,
    PRIMARY KEY (trade_id, direction, card_id)
);

CREATE TABLE IF NOT EXISTS challenger.trade_reject_votes (
    trade_id text NOT NULL REFERENCES challenger.trade_offers(id) ON DELETE CASCADE,
    user_id text NOT NULL,
    voted_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (trade_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_trades_league_created
    ON challenger.trade_offers(league_id, created_at DESC);
