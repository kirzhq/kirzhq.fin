package com.kirzhq.finances.repository;

import com.kirzhq.finances.domain.DebtPayment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DebtPaymentRepository extends JpaRepository<DebtPayment, Long> {
    @EntityGraph(attributePaths = "transaction")
    List<DebtPayment> findAllByDebtId(Long debtId);

    @EntityGraph(attributePaths = "transaction")
    List<DebtPayment> findAllByDebtIdIn(List<Long> debtIds);

    @Query("select p.transaction.id as transactionId, p.debt.name as debtName from DebtPayment p where p.transaction.id in :ids")
    List<TransactionDebt> findDebtNames(@Param("ids") Collection<Long> transactionIds);

    @EntityGraph(attributePaths = "debt")
    Optional<DebtPayment> findByTransactionId(Long transactionId);

    interface TransactionDebt {
        Long getTransactionId();
        String getDebtName();
    }
}
