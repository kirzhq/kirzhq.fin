package com.kirzhq.finances.repository;

import com.kirzhq.finances.domain.RequiredPaymentTransaction;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface RequiredPaymentTransactionRepository extends JpaRepository<RequiredPaymentTransaction, Long> {
    @EntityGraph(attributePaths = {"transaction", "requiredPayment"})
    List<RequiredPaymentTransaction> findAllByPeriod(LocalDate period);

    boolean existsByRequiredPaymentIdAndPeriod(Long requiredPaymentId, LocalDate period);
}
