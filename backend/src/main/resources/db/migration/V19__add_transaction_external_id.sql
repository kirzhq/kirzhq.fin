-- Id of the operation in the bank, for operations sent from the browser extension; keeps them from being added twice.
ALTER TABLE transactions ADD COLUMN external_id VARCHAR(128);
CREATE UNIQUE INDEX ux_transactions_external_id ON transactions (external_id);
