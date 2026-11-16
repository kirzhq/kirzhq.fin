package com.kirzhq.finances.repository;

import com.kirzhq.finances.domain.RequiredPaymentTransaction;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;

public interface RequiredPaymentTransactionRepository extends JpaRepository<RequiredPaymentTransaction, Long> {
    @EntityGraph(attributePaths = {"transaction", "requiredPayment"})
    List<RequiredPaymentTransaction> findAllByPeriod(LocalDate period);

    boolean existsByRequiredPaymentIdAndPeriod(Long requiredPaymentId, LocalDate period);

    boolean existsByRequiredPaymentId(Long requiredPaymentId);

    /** Ids of one-time payments that are already paid in any month. */
    @Query("select l.requiredPayment.id from RequiredPaymentTransaction l where l.requiredPayment.kind = com.kirzhq.finances.domain.RequiredPaymentKind.ONCE")
    List<Long> findPaidOnceIds();
}
