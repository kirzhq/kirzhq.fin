CREATE TABLE savings_goals (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    target_amount NUMERIC(19, 2) NOT NULL CHECK (target_amount > 0),
    target_date DATE,
    created_date DATE NOT NULL,
    note VARCHAR(1000) NOT NULL DEFAULT '',
    color VARCHAR(7) NOT NULL DEFAULT '#6c5ce7'
);

CREATE TABLE savings_entries (
    id BIGSERIAL PRIMARY KEY,
    goal_id BIGINT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
    amount NUMERIC(19, 2) NOT NULL CHECK (amount <> 0),
    entry_date DATE NOT NULL,
    comment VARCHAR(500) NOT NULL DEFAULT ''
);

CREATE INDEX idx_savings_entries_goal_date ON savings_entries(goal_id, entry_date DESC, id DESC);
