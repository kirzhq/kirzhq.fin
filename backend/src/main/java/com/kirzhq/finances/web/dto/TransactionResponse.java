package com.kirzhq.finances.web.dto;

import com.kirzhq.finances.domain.TransactionType;
import com.kirzhq.finances.domain.VehicleExpenseType;

import java.math.BigDecimal;
import java.time.LocalDate;

public record TransactionResponse(
        Long id,
        TransactionType type,
        String category,
        BigDecimal amount,
        LocalDate transactionDate,
        String description,
        Long vehicleId,
        String vehicleName,
        VehicleExpenseType vehicleExpenseType,
        Long odometerKm,
        BigDecimal fuelLiters,
        String foodSubcategory
) {
}
