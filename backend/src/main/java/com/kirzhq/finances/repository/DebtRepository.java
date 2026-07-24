package com.kirzhq.finances.repository;

import com.kirzhq.finances.domain.Debt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DebtRepository extends JpaRepository<Debt, Long> {
    List<Debt> findAllByOrderByCreatedDateDescIdDesc();
}
