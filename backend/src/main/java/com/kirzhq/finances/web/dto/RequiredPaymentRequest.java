package com.kirzhq.finances.web.dto;

import com.kirzhq.finances.domain.RequiredPaymentKind;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/** kind null means MONTHLY. MONTHLY needs dayOfMonth; ONCE takes an optional dueDate. */
public record RequiredPaymentRequest(
        RequiredPaymentKind kind,
        @NotBlank @Size(max = 255) String name,
        @NotBlank String category,
        @NotNull @DecimalMin(value = "0.01") BigDecimal amount,
        @Min(1) @Max(31) Integer dayOfMonth,
        LocalDate dueDate
) {
    public RequiredPaymentRequest(String name, String category, BigDecimal amount, Integer dayOfMonth) {
        this(RequiredPaymentKind.MONTHLY, name, category, amount, dayOfMonth, null);
    }
}
