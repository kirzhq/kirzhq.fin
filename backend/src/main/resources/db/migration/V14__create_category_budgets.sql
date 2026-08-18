CREATE TABLE category_budgets (
    id BIGSERIAL PRIMARY KEY,
    category VARCHAR(255) NOT NULL UNIQUE,
    monthly_limit NUMERIC(14, 2) NOT NULL CHECK (monthly_limit > 0)
);
