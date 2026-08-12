package com.kirzhq.finances.web.dto;

import com.kirzhq.finances.domain.TransactionType;
import com.kirzhq.finances.domain.VehicleExpenseType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ShortcutTransactionRequest(
        TransactionType type,
        @NotBlank String category,
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        LocalDate transactionDate,
        String description,
        VehicleExpenseType vehicleExpenseType,
        Long odometerKm,
        BigDecimal fuelLiters,
        String foodSubcategory
) {
}
