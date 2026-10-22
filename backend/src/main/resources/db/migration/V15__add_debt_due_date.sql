ALTER TABLE debts ADD COLUMN due_date DATE;

-- The overdue counter for this debt used to be hardcoded in the frontend.
UPDATE debts SET due_date = DATE '2024-09-16' WHERE lower(name) = lower('Яндекс Сплит');
