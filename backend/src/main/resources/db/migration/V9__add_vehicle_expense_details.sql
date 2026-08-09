ALTER TABLE transactions
    ADD COLUMN vehicle_expense_type VARCHAR(20),
    ADD COLUMN odometer_km BIGINT;

UPDATE transactions
SET vehicle_expense_type = CASE
    WHEN description ~* '(бенз|азс|топлив)' THEN 'FUEL'
    ELSE 'OTHER'
END
WHERE vehicle_id IS NOT NULL;

ALTER TABLE transactions
    ADD CONSTRAINT transactions_vehicle_expense_type_check
        CHECK (vehicle_expense_type IS NULL OR vehicle_expense_type IN ('FUEL', 'OTHER')),
    ADD CONSTRAINT transactions_odometer_positive_check
        CHECK (odometer_km IS NULL OR odometer_km > 0),
    ADD CONSTRAINT transactions_vehicle_details_check
        CHECK (
            (vehicle_id IS NULL AND vehicle_expense_type IS NULL AND odometer_km IS NULL)
            OR
            (vehicle_id IS NOT NULL AND vehicle_expense_type IS NOT NULL
                AND (odometer_km IS NULL OR vehicle_expense_type = 'FUEL'))
        );

CREATE INDEX idx_transactions_vehicle_expense_type
    ON transactions (vehicle_id, vehicle_expense_type, transaction_date);
