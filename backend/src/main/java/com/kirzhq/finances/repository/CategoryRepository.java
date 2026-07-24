package com.kirzhq.finances.repository;

import com.kirzhq.finances.domain.Category;
import com.kirzhq.finances.domain.TransactionType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    List<Category> findAllByOrderByTypeAscNameAsc();
    boolean existsByNameIgnoreCaseAndType(String name, TransactionType type);
}
