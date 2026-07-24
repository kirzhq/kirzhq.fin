CREATE TABLE debts (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    initial_amount NUMERIC(19, 2) NOT NULL CHECK (initial_amount > 0),
    created_date DATE NOT NULL,
    note VARCHAR(1000) NOT NULL DEFAULT ''
);

CREATE TABLE debt_payments (
    id BIGSERIAL PRIMARY KEY,
    debt_id BIGINT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    transaction_id BIGINT NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE INDEX idx_debt_payments_debt_id ON debt_payments (debt_id);
