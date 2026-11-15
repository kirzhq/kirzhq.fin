package com.kirzhq.finances.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A required payment as it stands in one month. status is PAID, OVERDUE (due date passed, not paid)
 * or UPCOMING. The paid* fields are set only when it is PAID.
 */
public record RequiredPaymentResponse(
        Long id,
        String name,
        String category,
        BigDecimal amount,
        int dayOfMonth,
        LocalDate dueDate,
        String status,
        Long transactionId,
        BigDecimal paidAmount,
        LocalDate paidDate
) {}
