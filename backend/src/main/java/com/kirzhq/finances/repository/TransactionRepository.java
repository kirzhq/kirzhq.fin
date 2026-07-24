package com.kirzhq.finances.repository;

import com.kirzhq.finances.domain.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {
}
