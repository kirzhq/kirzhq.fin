package com.kirzhq.finances.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record DebtResponse(
        Long id,
        String name,
        BigDecimal initialAmount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount,
        int progressPercent,
        LocalDate createdDate,
        String note,
        List<Payment> payments
) {
    public record Payment(Long id, Long transactionId, BigDecimal amount, LocalDate paymentDate, String comment) {
    }
}
