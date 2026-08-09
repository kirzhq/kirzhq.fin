ALTER TABLE transactions
    ADD COLUMN fuel_liters NUMERIC(10, 3);

ALTER TABLE transactions
    ADD CONSTRAINT transactions_fuel_liters_positive_check
        CHECK (fuel_liters IS NULL OR fuel_liters > 0),
    ADD CONSTRAINT transactions_fuel_liters_type_check
        CHECK (fuel_liters IS NULL OR vehicle_expense_type = 'FUEL');
