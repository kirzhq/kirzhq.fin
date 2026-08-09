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
import java.util.List;

@Service
public class BackupService {
    private final JdbcTemplate jdbc;

    public BackupService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public BackupData exportData() {
        return new BackupData(
                2, Instant.now(),
                jdbc.query("SELECT id, name, type FROM categories ORDER BY id",
                        (rs, row) -> new BackupData.CategoryItem(rs.getLong("id"), rs.getString("name"),
                                TransactionType.valueOf(rs.getString("type")))),
                jdbc.query("SELECT id, name FROM vehicles ORDER BY id",
                        (rs, row) -> new BackupData.VehicleItem(rs.getLong("id"), rs.getString("name"))),
                jdbc.query("""
                        SELECT id, type, category, amount, transaction_date, description, vehicle_id,
                               vehicle_expense_type, odometer_km
                        FROM transactions ORDER BY id
                        """, (rs, row) -> new BackupData.TransactionItem(
                                rs.getLong("id"), TransactionType.valueOf(rs.getString("type")),
                                rs.getString("category"), rs.getBigDecimal("amount"),
                                rs.getDate("transaction_date").toLocalDate(), rs.getString("description"),
                                rs.getObject("vehicle_id", Long.class),
                                rs.getString("vehicle_expense_type") == null ? null
                                        : VehicleExpenseType.valueOf(rs.getString("vehicle_expense_type")),
                                rs.getObject("odometer_km", Long.class))),
                jdbc.query("SELECT id, name, initial_amount, created_date, note FROM debts ORDER BY id",
                        (rs, row) -> new BackupData.DebtItem(
                                rs.getLong("id"), rs.getString("name"), rs.getBigDecimal("initial_amount"),
                                rs.getDate("created_date").toLocalDate(), rs.getString("note"))),
                jdbc.query("SELECT id, debt_id, transaction_id FROM debt_payments ORDER BY id",
                        (rs, row) -> new BackupData.DebtPaymentItem(
                                rs.getLong("id"), rs.getLong("debt_id"), rs.getLong("transaction_id")))
        );
    }

    @Transactional
    public void importData(BackupData backup) {
        validate(backup);
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

        resetSequence("categories");
        resetSequence("vehicles");
        resetSequence("transactions");
        resetSequence("debts");
        resetSequence("debt_payments");
    }

    private void validate(BackupData backup) {
        if (backup == null || (backup.version() != 1 && backup.version() != 2)
                || backup.categories() == null || backup.vehicles() == null
                || backup.transactions() == null || backup.debts() == null
                || backup.debtPayments() == null) {
            throw new IllegalArgumentException("Неверный или неподдерживаемый файл резервной копии");
        }
    }

    private void batchCategories(List<BackupData.CategoryItem> items) {
        if (items.isEmpty()) return;
        jdbc.batchUpdate("INSERT INTO categories (id, name, type) VALUES (?, ?, ?)", items, items.size(),
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
                     vehicle_expense_type, odometer_km)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, items, items.size(), (statement, item) -> {
                    statement.setLong(1, item.id());
                    statement.setString(2, item.type().name());
                    statement.setString(3, item.category());
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
                });
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
