package com.kirzhq.finances.repository;

import com.kirzhq.finances.domain.CategoryBudget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryBudgetRepository extends JpaRepository<CategoryBudget, Long> {
    List<CategoryBudget> findAllByOrderByCategoryAsc();
    Optional<CategoryBudget> findByCategoryIgnoreCase(String category);
}
