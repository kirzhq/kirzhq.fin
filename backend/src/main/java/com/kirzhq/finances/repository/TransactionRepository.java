package com.kirzhq.finances.repository;

import com.kirzhq.finances.domain.Transaction;
import com.kirzhq.finances.domain.TransactionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    List<Transaction> findAllByTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateDescIdDesc(
            LocalDate from, LocalDate to);

    List<Transaction> findAllByVehicleIdAndTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateAscIdAsc(
            Long vehicleId, LocalDate from, LocalDate to);

    List<Transaction> findAllByVehicleIdOrderByTransactionDateAscIdAsc(Long vehicleId);

    long countByCategoryAndType(String category, TransactionType type);

    @Modifying
    @Query("update Transaction t set t.category = :to where t.category = :from and t.type = :type")
    int moveCategory(@Param("from") String from, @Param("to") String to, @Param("type") TransactionType type);
}
