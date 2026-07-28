-- Card definitions are separate from owned inventory, weekly offers, and plays.
CREATE TABLE IF NOT EXISTS challenger.power_cards (
    id text PRIMARY KEY,
    label text NOT NULL,
    description text NOT NULL,
    effect_text text NOT NULL,
    duration text NOT NULL,
    accent text NOT NULL,
    icon text NOT NULL,
    allowed_team text NOT NULL CHECK (allowed_team IN ('SELF','OPPONENT')),
    rarity text NOT NULL CHECK (rarity IN ('Common','Rare','Epic','Legendary')),
    card_type text NOT NULL CHECK (card_type IN ('Strategy','Tactic','Review'))
);

CREATE TABLE IF NOT EXISTS challenger.power_card_positions (
    card_id text NOT NULL REFERENCES challenger.power_cards(id) ON DELETE CASCADE,
    position text NOT NULL,
    PRIMARY KEY (card_id, position)
);

CREATE TABLE IF NOT EXISTS challenger.team_card_inventory (
    league_id text NOT NULL,
    user_id text NOT NULL,
    card_id text NOT NULL REFERENCES challenger.power_cards(id) ON DELETE RESTRICT,
    quantity integer NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (league_id, user_id, card_id),
    FOREIGN KEY (league_id, user_id)
        REFERENCES challenger.league_memberships(league_id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS challenger.card_claim_progress (
    league_id text NOT NULL,
    user_id text NOT NULL,
    week integer NOT NULL CHECK (week > 0),
    allowance integer NOT NULL CHECK (allowance >= 0),
    claimed_count integer NOT NULL CHECK (claimed_count BETWEEN 0 AND allowance),
    offer_id text,
    PRIMARY KEY (league_id, user_id, week),
    FOREIGN KEY (league_id, user_id)
        REFERENCES challenger.league_memberships(league_id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS challenger.card_claim_offer_cards (
    league_id text NOT NULL,
    user_id text NOT NULL,
    week integer NOT NULL,
    card_id text NOT NULL REFERENCES challenger.power_cards(id) ON DELETE RESTRICT,
    ordinal integer NOT NULL CHECK (ordinal >= 0),
    PRIMARY KEY (league_id, user_id, week, card_id),
    UNIQUE (league_id, user_id, week, ordinal),
    FOREIGN KEY (league_id, user_id, week)
        REFERENCES challenger.card_claim_progress(league_id, user_id, week) ON DELETE CASCADE
);
