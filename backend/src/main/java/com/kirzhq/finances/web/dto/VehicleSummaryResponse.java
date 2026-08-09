package com.kirzhq.finances.web.dto;

import java.math.BigDecimal;

public record VehicleSummaryResponse(
        BigDecimal total,
        BigDecimal fuel,
        BigDecimal other,
        BigDecimal averageMonthlyFuel,
        int activeMonths,
        int operationCount,
        Long firstOdometerKm,
        Long latestOdometerKm,
        Long mileageKm,
        BigDecimal fuelConsumptionPer100Km,
        BigDecimal fuelCostPer100Km,
        BigDecimal latestFuelConsumptionPer100Km,
        BigDecimal latestFuelCostPer100Km,
        boolean mileageComplete
) {
}
