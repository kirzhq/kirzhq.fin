ALTER TABLE transactions ADD COLUMN food_subcategory VARCHAR(80);

UPDATE transactions
SET food_subcategory = CASE
    WHEN category = 'Еда улица' AND lower(description) ~ '(мак|ростикс|kfc|токио|ресторан|кафе|шав|вьетнам|вок|wok|тц)' THEN 'Ресторан'
    WHEN category = 'Еда доставки' AND lower(description) ~ '(озон|fresh|фреш|лента|магазин|продукт)' THEN 'Доставка из магазина'
    WHEN category = 'Еда домой' AND lower(description) ~ '(лента|магазин|продукт)' THEN 'Продукты'
    WHEN category = 'Еда домой' AND lower(description) ~ '(готов|нагг|наген|кулинари|апетит|аппетит|суп|еда)' THEN 'Готовая еда'
    WHEN category = 'Еда улица' THEN 'Перекус'
    WHEN category = 'Еда доставки' THEN 'Доставка из ресторанов'
    WHEN category = 'Еда домой' THEN 'Доставка из магазина'
END
WHERE category IN ('Еда улица', 'Еда доставки', 'Еда домой');

UPDATE transactions
SET category = 'Еда'
WHERE category IN ('Еда улица', 'Еда доставки', 'Еда домой');

INSERT INTO categories (name, type)
SELECT 'Еда', 'EXPENSE'
WHERE NOT EXISTS (
    SELECT 1 FROM categories WHERE lower(name) = lower('Еда') AND type = 'EXPENSE'
);

DELETE FROM categories
WHERE type = 'EXPENSE' AND name IN ('Еда улица', 'Еда доставки', 'Еда домой');
