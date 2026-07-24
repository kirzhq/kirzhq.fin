package com.kirzhq.finances.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DebtRequest(
        @NotBlank @Size(max = 255) String name,
        @NotNull @Positive BigDecimal initialAmount,
        @NotNull LocalDate createdDate,
        @Size(max = 1000) String note
) {
}
