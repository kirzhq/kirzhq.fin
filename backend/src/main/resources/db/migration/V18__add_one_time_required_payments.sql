-- A payment is either monthly (day_of_month) or one-time: known amount, date optional ("not sure when yet").
ALTER TABLE required_payments ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE required_payments ALTER COLUMN day_of_month DROP NOT NULL;
ALTER TABLE required_payments ADD COLUMN due_date DATE;
ALTER TABLE required_payments ADD CONSTRAINT required_payments_kind_check
    CHECK ((kind = 'MONTHLY' AND day_of_month IS NOT NULL AND due_date IS NULL)
        OR (kind = 'ONCE' AND day_of_month IS NULL));
