package com.kirzhq.finances.repository;

import com.kirzhq.finances.domain.DebtPayment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DebtPaymentRepository extends JpaRepository<DebtPayment, Long> {
    @EntityGraph(attributePaths = "transaction")
    List<DebtPayment> findAllByDebtId(Long debtId);

    @EntityGraph(attributePaths = "transaction")
    List<DebtPayment> findAllByDebtIdIn(List<Long> debtIds);
}
