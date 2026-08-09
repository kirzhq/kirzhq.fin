ALTER TABLE transactions
    DROP CONSTRAINT transactions_vehicle_expense_type_check;

ALTER TABLE transactions
    ADD CONSTRAINT transactions_vehicle_expense_type_check
        CHECK (vehicle_expense_type IS NULL OR vehicle_expense_type IN ('FUEL', 'MAINTENANCE', 'OTHER'));
