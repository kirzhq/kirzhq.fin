package com.kirzhq.finances.repository;

import com.kirzhq.finances.domain.SavingsGoal;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SavingsGoalRepository extends JpaRepository<SavingsGoal, Long> {
    List<SavingsGoal> findAllByOrderByCreatedDateDescIdDesc();
}
