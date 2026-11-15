package com.kirzhq.finances.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Pays a required payment for the given month; the operation date may fall into another month. */
public record RequiredPaymentPayRequest(
        @NotNull @Min(2000) @Max(2100) Integer year,
        @NotNull @Min(1) @Max(12) Integer month,
        @NotNull @DecimalMin(value = "0.01") BigDecimal amount,
        @NotNull LocalDate paymentDate
) {}
