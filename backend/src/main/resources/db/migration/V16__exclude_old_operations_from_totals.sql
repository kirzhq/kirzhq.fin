-- Operations kept for history (fuel log, mileage) that must not count in totals and charts.
ALTER TABLE transactions ADD COLUMN excluded_from_totals BOOLEAN NOT NULL DEFAULT FALSE;

-- The history was restarted on 24.10.2026; only vehicle operations were kept from before.
UPDATE transactions SET excluded_from_totals = TRUE WHERE transaction_date < DATE '2026-10-24';
