package com.kirzhq.finances.web.dto;

import com.kirzhq.finances.domain.TransactionType;
import com.kirzhq.finances.domain.VehicleExpenseType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record BackupData(
        int version,
        Instant exportedAt,
        List<CategoryItem> categories,
        List<VehicleItem> vehicles,
        List<TransactionItem> transactions,
        List<DebtItem> debts,
        List<DebtPaymentItem> debtPayments,
        List<SavingsGoalItem> savingsGoals,
        List<SavingsEntryItem> savingsEntries
) {
    public record CategoryItem(Long id, String name, TransactionType type) {}
    public record VehicleItem(Long id, String name) {}
    public record TransactionItem(Long id, TransactionType type, String category, BigDecimal amount,
            LocalDate transactionDate, String description, Long vehicleId,
            VehicleExpenseType vehicleExpenseType, Long odometerKm, BigDecimal fuelLiters, String foodSubcategory) {}
    public record DebtItem(Long id, String name, BigDecimal initialAmount, LocalDate createdDate, String note) {}
    public record DebtPaymentItem(Long id, Long debtId, Long transactionId) {}
    public record SavingsGoalItem(Long id, String name, BigDecimal targetAmount, LocalDate targetDate,
            LocalDate createdDate, String note, String color) {}
    public record SavingsEntryItem(Long id, Long goalId, BigDecimal amount, LocalDate entryDate, String comment) {}
}
