package com.kirzhq.finances.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DebtPaymentRequest(
        @NotNull @Positive BigDecimal amount,
        @NotNull LocalDate paymentDate,
        @Size(max = 500) String comment
) {
}
