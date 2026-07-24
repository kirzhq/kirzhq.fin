INSERT INTO vehicles (name)
VALUES ('Lada Vesta')
ON CONFLICT (name) DO NOTHING;

UPDATE transactions
SET vehicle_id = (SELECT id FROM vehicles WHERE name = 'Lada Vesta')
WHERE category = 'Машина';

DELETE FROM vehicles
WHERE name <> 'Lada Vesta';
