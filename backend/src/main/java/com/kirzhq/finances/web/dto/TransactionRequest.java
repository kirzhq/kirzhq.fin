package com.kirzhq.finances.web.dto;

import com.kirzhq.finances.domain.TransactionType;
import com.kirzhq.finances.domain.VehicleExpenseType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record TransactionRequest(
        @NotNull TransactionType type,
        @NotBlank String category,
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        @NotNull LocalDate transactionDate,
        String description,
        Long vehicleId,
        VehicleExpenseType vehicleExpenseType,
        Long odometerKm,
        BigDecimal fuelLiters,
        String foodSubcategory,
        /** Null keeps the current value, so callers that do not know about it cannot reset it. */
        Boolean excludedFromTotals
) {
    public TransactionRequest(TransactionType type, String category, BigDecimal amount, LocalDate transactionDate,
            String description, Long vehicleId, VehicleExpenseType vehicleExpenseType, Long odometerKm,
            BigDecimal fuelLiters, String foodSubcategory) {
        this(type, category, amount, transactionDate, description, vehicleId, vehicleExpenseType, odometerKm,
                fuelLiters, foodSubcategory, null);
    }
}
