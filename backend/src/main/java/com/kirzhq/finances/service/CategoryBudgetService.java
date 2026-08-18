package com.kirzhq.finances.service;

import com.kirzhq.finances.domain.CategoryBudget;
import com.kirzhq.finances.domain.TransactionType;
import com.kirzhq.finances.repository.CategoryBudgetRepository;
import com.kirzhq.finances.web.dto.CategoryBudgetRequest;
import com.kirzhq.finances.web.dto.CategoryBudgetResponse;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CategoryBudgetService {
    private final CategoryBudgetRepository repository;
    private final CategoryService categoryService;

    public CategoryBudgetService(CategoryBudgetRepository repository, CategoryService categoryService) {
        this.repository = repository;
        this.categoryService = categoryService;
    }

    public List<CategoryBudgetResponse> findAll() {
        return repository.findAllByOrderByCategoryAsc().stream().map(this::response).toList();
    }

    public CategoryBudgetResponse save(CategoryBudgetRequest request) {
        String category = request.category().trim();
        if (!categoryService.exists(category, TransactionType.EXPENSE)) {
            throw new IllegalArgumentException("Категория расходов не существует");
        }
        CategoryBudget budget = repository.findByCategoryIgnoreCase(category).orElseGet(CategoryBudget::new);
        budget.setCategory(category);
        budget.setMonthlyLimit(request.monthlyLimit());
        return response(repository.save(budget));
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) throw new IllegalArgumentException("Лимит не найден");
        repository.deleteById(id);
    }

    private CategoryBudgetResponse response(CategoryBudget budget) {
        return new CategoryBudgetResponse(budget.getId(), budget.getCategory(), budget.getMonthlyLimit());
    }
}
