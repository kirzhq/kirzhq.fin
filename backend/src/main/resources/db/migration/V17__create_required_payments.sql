-- Monthly mandatory payments (rent, internet, subscriptions) and the operations that paid them.
CREATE TABLE required_payments (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31)
);

-- period is the first day of the month the payment was for, so a late payment still closes its own month.
CREATE TABLE required_payment_transactions (
    id BIGSERIAL PRIMARY KEY,
    required_payment_id BIGINT NOT NULL REFERENCES required_payments(id) ON DELETE CASCADE,
    transaction_id BIGINT NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
    period DATE NOT NULL,
    UNIQUE (required_payment_id, period)
);

CREATE INDEX idx_required_payment_transactions_period ON required_payment_transactions (period);
