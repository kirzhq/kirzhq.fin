package com.kirzhq.finances.repository;

import com.kirzhq.finances.domain.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    List<Transaction> findAllByTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateDescIdDesc(
            LocalDate from, LocalDate to);

    List<Transaction> findAllByVehicleIdAndTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateAscIdAsc(
            Long vehicleId, LocalDate from, LocalDate to);
}
