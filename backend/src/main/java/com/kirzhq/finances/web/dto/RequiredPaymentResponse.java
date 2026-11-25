package com.kirzhq.finances.web.dto;

import com.kirzhq.finances.domain.RequiredPaymentKind;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A payment as it stands in one month. status is PAID, OVERDUE (due date passed, not paid) or UPCOMING.
 * dueDate is null for a one-time payment whose date is not known yet. The paid* fields are set only when PAID.
 */
public record RequiredPaymentResponse(
        Long id,
        RequiredPaymentKind kind,
        String name,
        String category,
        BigDecimal amount,
        Integer dayOfMonth,
        LocalDate dueDate,
        String status,
        Long transactionId,
        BigDecimal paidAmount,
        LocalDate paidDate
) {}
