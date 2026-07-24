package com.kirzhq.finances.web.dto;

import java.math.BigDecimal;
import java.util.List;

public record SummaryResponse(
        BigDecimal income,
        BigDecimal expense,
        BigDecimal balance,
        BigDecimal averageDailyExpense,
        BigDecimal foodExpense,
        BigDecimal averageDailyFoodExpense,
        int calculationDays,
        List<MonthlyPoint> monthlyPoints,
        List<CategoryPoint> categoryPoints
) {

    public record MonthlyPoint(String month, BigDecimal income, BigDecimal expense) {
    }

    public record CategoryPoint(String category, BigDecimal amount) {
    }
}
