package com.kirzhq.finances.repository;

import com.kirzhq.finances.domain.DebtPayment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DebtPaymentRepository extends JpaRepository<DebtPayment, Long> {
    List<DebtPayment> findAllByDebtId(Long debtId);
}
