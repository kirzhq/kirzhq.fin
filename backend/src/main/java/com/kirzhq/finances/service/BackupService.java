package com.kirzhq.finances.service;

import com.kirzhq.finances.domain.TransactionType;
import com.kirzhq.finances.domain.VehicleExpenseType;
import com.kirzhq.finances.web.dto.BackupData;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Types;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class BackupService {
    private final JdbcTemplate jdbc;

    public BackupService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public BackupData exportData() {
        return new BackupData(
                5, Instant.now(),
                jdbc.query("SELECT id, name, type FROM categories ORDER BY id",
                        (rs, row) -> new BackupData.CategoryItem(rs.getLong("id"), rs.getString("name"),
                                TransactionType.valueOf(rs.getString("type")))),
                jdbc.query("SELECT id, name FROM vehicles ORDER BY id",
                        (rs, row) -> new BackupData.VehicleItem(rs.getLong("id"), rs.getString("name"))),
                jdbc.query("""
                        SELECT id, type, category, amount, transaction_date, description, vehicle_id,
                               vehicle_expense_type, odometer_km, fuel_liters, food_subcategory
                        FROM transactions ORDER BY id
                        """, (rs, row) -> new BackupData.TransactionItem(
                                rs.getLong("id"), TransactionType.valueOf(rs.getString("type")),
                                rs.getString("category"), rs.getBigDecimal("amount"),
                                rs.getDate("transaction_date").toLocalDate(), rs.getString("description"),
                                rs.getObject("vehicle_id", Long.class),
                                rs.getString("vehicle_expense_type") == null ? null
                                        : VehicleExpenseType.valueOf(rs.getString("vehicle_expense_type")),
                                rs.getObject("odometer_km", Long.class), rs.getBigDecimal("fuel_liters"),
                                rs.getString("food_subcategory"))),
                jdbc.query("SELECT id, name, initial_amount, created_date, note FROM debts ORDER BY id",
                        (rs, row) -> new BackupData.DebtItem(
                                rs.getLong("id"), rs.getString("name"), rs.getBigDecimal("initial_amount"),
                                rs.getDate("created_date").toLocalDate(), rs.getString("note"))),
                jdbc.query("SELECT id, debt_id, transaction_id FROM debt_payments ORDER BY id",
                        (rs, row) -> new BackupData.DebtPaymentItem(
                                rs.getLong("id"), rs.getLong("debt_id"), rs.getLong("transaction_id"))),
                jdbc.query("SELECT id, name, target_amount, target_date, created_date, note, color FROM savings_goals ORDER BY id",
                        (rs, row) -> new BackupData.SavingsGoalItem(rs.getLong("id"), rs.getString("name"),
                                rs.getBigDecimal("target_amount"), rs.getDate("target_date") == null ? null : rs.getDate("target_date").toLocalDate(),
                                rs.getDate("created_date").toLocalDate(), rs.getString("note"), rs.getString("color"))),
                jdbc.query("SELECT id, goal_id, amount, entry_date, comment FROM savings_entries ORDER BY id",
                        (rs, row) -> new BackupData.SavingsEntryItem(rs.getLong("id"), rs.getLong("goal_id"),
                                rs.getBigDecimal("amount"), rs.getDate("entry_date").toLocalDate(), rs.getString("comment")))
        );
    }

    @Transactional
    public void importData(BackupData backup) {
        validate(backup);
        jdbc.update("DELETE FROM savings_entries");
        jdbc.update("DELETE FROM savings_goals");
        jdbc.update("DELETE FROM debt_payments");
        jdbc.update("DELETE FROM debts");
        jdbc.update("DELETE FROM transactions");
        jdbc.update("DELETE FROM categories");
        jdbc.update("DELETE FROM vehicles");

        batchCategories(backup.categories());
        batchVehicles(backup.vehicles());
        batchTransactions(backup.transactions());
        batchDebts(backup.debts());
        batchDebtPayments(backup.debtPayments());
        batchSavingsGoals(backup.savingsGoals() == null ? List.of() : backup.savingsGoals());
        batchSavingsEntries(backup.savingsEntries() == null ? List.of() : backup.savingsEntries());

        resetSequence("categories");
        resetSequence("vehicles");
        resetSequence("transactions");
        resetSequence("debts");
        resetSequence("debt_payments");
        resetSequence("savings_goals");
        resetSequence("savings_entries");
    }

    private void validate(BackupData backup) {
        if (backup == null || (backup.version() < 1 || backup.version() > 5)
                || backup.categories() == null || backup.vehicles() == null
                || backup.transactions() == null || backup.debts() == null
                || backup.debtPayments() == null) {
            throw new IllegalArgumentException("Неверный или неподдерживаемый файл резервной копии");
        }
    }

    private void batchCategories(List<BackupData.CategoryItem> items) {
        if (items.isEmpty()) return;
        List<BackupData.CategoryItem> normalized = new ArrayList<>();
        BackupData.CategoryItem firstLegacyFood = null;
        boolean hasFood = items.stream().anyMatch(item -> item.type() == TransactionType.EXPENSE && "Еда".equals(item.name()));
        for (BackupData.CategoryItem item : items) {
            if (isLegacyFoodCategory(item.name())) {
                if (firstLegacyFood == null) firstLegacyFood = item;
            } else {
                normalized.add(item);
            }
        }
        if (!hasFood && firstLegacyFood != null) {
            normalized.add(new BackupData.CategoryItem(firstLegacyFood.id(), "Еда", TransactionType.EXPENSE));
        }
        jdbc.batchUpdate("INSERT INTO categories (id, name, type) VALUES (?, ?, ?)", normalized, normalized.size(),
                (statement, item) -> {
                    statement.setLong(1, item.id());
                    statement.setString(2, item.name());
                    statement.setString(3, item.type().name());
                });
    }

    private void batchVehicles(List<BackupData.VehicleItem> items) {
        if (items.isEmpty()) return;
        jdbc.batchUpdate("INSERT INTO vehicles (id, name) VALUES (?, ?)", items, items.size(),
                (statement, item) -> {
                    statement.setLong(1, item.id());
                    statement.setString(2, item.name());
                });
    }

    private void batchTransactions(List<BackupData.TransactionItem> items) {
        if (items.isEmpty()) return;
        jdbc.batchUpdate("""
                INSERT INTO transactions
                    (id, type, category, amount, transaction_date, description, vehicle_id,
                     vehicle_expense_type, odometer_km, fuel_liters, food_subcategory)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, items, items.size(), (statement, item) -> {
                    statement.setLong(1, item.id());
                    statement.setString(2, item.type().name());
                    statement.setString(3, isLegacyFoodCategory(item.category()) ? "Еда" : item.category());
                    statement.setBigDecimal(4, item.amount());
                    statement.setDate(5, Date.valueOf(item.transactionDate()));
                    statement.setString(6, item.description());
                    nullableLong(statement, 7, item.vehicleId());
                    if (item.vehicleId() == null) {
                        statement.setNull(8, Types.VARCHAR);
                    } else {
                        statement.setString(8, (item.vehicleExpenseType() == null
                                ? VehicleExpenseType.OTHER : item.vehicleExpenseType()).name());
                    }
                    nullableLong(statement, 9, item.vehicleExpenseType() == VehicleExpenseType.FUEL
                            ? item.odometerKm() : null);
                    if (item.vehicleExpenseType() == VehicleExpenseType.FUEL && item.fuelLiters() != null) {
                        statement.setBigDecimal(10, item.fuelLiters());
                    } else {
                        statement.setNull(10, Types.NUMERIC);
                    }
                    String foodSubcategory = normalizeFoodSubcategory(item.category(), item.description(), item.foodSubcategory());
                    if (foodSubcategory == null) statement.setNull(11, Types.VARCHAR);
                    else statement.setString(11, foodSubcategory);
                });
    }

    private boolean isLegacyFoodCategory(String category) {
        return "Еда улица".equals(category) || "Еда доставки".equals(category) || "Еда домой".equals(category);
    }

    private String normalizeFoodSubcategory(String category, String description, String provided) {
        if ("Еда".equals(category)) return provided == null || provided.isBlank() ? "Перекус" : provided;
        if (!isLegacyFoodCategory(category)) return null;
        String text = description == null ? "" : description.toLowerCase(Locale.ROOT);
        if ("Еда улица".equals(category)) {
            return containsAny(text, "мак", "ростикс", "kfc", "токио", "ресторан", "кафе", "шав", "вьетнам", "вок", "wok", "тц")
                    ? "Ресторан" : "Перекус";
        }
        if ("Еда доставки".equals(category)) {
            return containsAny(text, "озон", "fresh", "фреш", "лента", "магазин", "продукт")
                    ? "Доставка из магазина" : "Доставка из ресторанов";
        }
        if (containsAny(text, "лента", "магазин", "продукт")) return "Продукты";
        if (containsAny(text, "готов", "нагг", "наген", "кулинари", "апетит", "аппетит", "суп", "еда")) return "Готовая еда";
        return "Доставка из магазина";
    }

    private boolean containsAny(String value, String... needles) {
        for (String needle : needles) if (value.contains(needle)) return true;
        return false;
    }

    private void batchDebts(List<BackupData.DebtItem> items) {
        if (items.isEmpty()) return;
        jdbc.batchUpdate("INSERT INTO debts (id, name, initial_amount, created_date, note) VALUES (?, ?, ?, ?, ?)",
                items, items.size(), (statement, item) -> {
                    statement.setLong(1, item.id());
                    statement.setString(2, item.name());
                    statement.setBigDecimal(3, item.initialAmount());
                    statement.setDate(4, Date.valueOf(item.createdDate()));
                    statement.setString(5, item.note());
                });
    }

    private void batchDebtPayments(List<BackupData.DebtPaymentItem> items) {
        if (items.isEmpty()) return;
        jdbc.batchUpdate("INSERT INTO debt_payments (id, debt_id, transaction_id) VALUES (?, ?, ?)",
                items, items.size(), (statement, item) -> {
                    statement.setLong(1, item.id());
                    statement.setLong(2, item.debtId());
                    statement.setLong(3, item.transactionId());
                });
    }

    private void batchSavingsGoals(List<BackupData.SavingsGoalItem> items) {
        if (items.isEmpty()) return;
        jdbc.batchUpdate("INSERT INTO savings_goals (id, name, target_amount, target_date, created_date, note, color) VALUES (?, ?, ?, ?, ?, ?, ?)",
                items, items.size(), (statement, item) -> {
                    statement.setLong(1, item.id()); statement.setString(2, item.name());
                    statement.setBigDecimal(3, item.targetAmount());
                    if (item.targetDate() == null) statement.setNull(4, Types.DATE); else statement.setDate(4, Date.valueOf(item.targetDate()));
                    statement.setDate(5, Date.valueOf(item.createdDate())); statement.setString(6, item.note());
                    statement.setString(7, item.color());
                });
    }

    private void batchSavingsEntries(List<BackupData.SavingsEntryItem> items) {
        if (items.isEmpty()) return;
        jdbc.batchUpdate("INSERT INTO savings_entries (id, goal_id, amount, entry_date, comment) VALUES (?, ?, ?, ?, ?)",
                items, items.size(), (statement, item) -> {
                    statement.setLong(1, item.id()); statement.setLong(2, item.goalId());
                    statement.setBigDecimal(3, item.amount()); statement.setDate(4, Date.valueOf(item.entryDate()));
                    statement.setString(5, item.comment());
                });
    }

    private void nullableLong(PreparedStatement statement, int index, Long value) throws java.sql.SQLException {
        if (value == null) statement.setNull(index, Types.BIGINT);
        else statement.setLong(index, value);
    }

    private void resetSequence(String table) {
        jdbc.execute("""
                SELECT setval(
                    pg_get_serial_sequence('%s', 'id'),
                    COALESCE((SELECT MAX(id) FROM %s), 1),
                    EXISTS (SELECT 1 FROM %s)
                )
                """.formatted(table, table, table));
    }
}
