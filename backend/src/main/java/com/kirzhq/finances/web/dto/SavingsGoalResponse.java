package com.kirzhq.finances.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record SavingsGoalResponse(
        Long id, String name, BigDecimal targetAmount, BigDecimal savedAmount,
        BigDecimal remainingAmount, int progressPercent, LocalDate targetDate,
        LocalDate createdDate, String note, String color, BigDecimal averageMonthly,
        LocalDate projectedDate, BigDecimal recommendedMonthly, List<Entry> entries) {
    public record Entry(Long id, BigDecimal amount, LocalDate entryDate, String comment) {}
}
