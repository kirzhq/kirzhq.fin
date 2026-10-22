package com.kirzhq.finances.service;

import com.kirzhq.finances.domain.Category;
import com.kirzhq.finances.domain.TransactionType;
import com.kirzhq.finances.repository.CategoryBudgetRepository;
import com.kirzhq.finances.repository.CategoryRepository;
import com.kirzhq.finances.repository.TransactionRepository;
import com.kirzhq.finances.web.dto.CategoryRequest;
import com.kirzhq.finances.web.dto.CategoryResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
public class CategoryService {

    /** These expense categories drive special logic (food subcategories, vehicle, debts) and must keep their names. */
    private static final Set<String> SYSTEM_EXPENSE_CATEGORIES = Set.of("еда", "машина", "долги");

    private final CategoryRepository categoryRepository;
    private final TransactionRepository transactionRepository;
    private final CategoryBudgetRepository budgetRepository;

    public CategoryService(CategoryRepository categoryRepository, TransactionRepository transactionRepository,
            CategoryBudgetRepository budgetRepository) {
        this.categoryRepository = categoryRepository;
        this.transactionRepository = transactionRepository;
        this.budgetRepository = budgetRepository;
    }

    public List<CategoryResponse> findAll() {
        return categoryRepository.findAllByOrderByTypeAscNameAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    public CategoryResponse create(CategoryRequest request) {
        String name = request.name().trim();
        if (categoryRepository.existsByNameIgnoreCaseAndType(name, request.type())) {
            throw new IllegalArgumentException("Категория «" + name + "» уже есть");
        }

        Category category = new Category();
        category.setName(name);
        category.setType(request.type());
        return toResponse(categoryRepository.save(category));
    }

    @Transactional
    public CategoryResponse rename(Long id, String newName) {
        Category category = get(id);
        String name = newName == null ? "" : newName.trim();
        if (name.isEmpty() || name.length() > 255) {
            throw new IllegalArgumentException("Название должно быть от 1 до 255 символов");
        }
        if (isSystem(category)) {
            throw new IllegalArgumentException("Категорию «" + category.getName() + "» переименовать нельзя: на ней держится отдельный раздел");
        }
        if (name.equals(category.getName())) return toResponse(category);
        if (!name.equalsIgnoreCase(category.getName()) && categoryRepository.existsByNameIgnoreCaseAndType(name, category.getType())) {
            throw new IllegalArgumentException("Категория «" + name + "» уже есть");
        }
        String oldName = category.getName();
        transactionRepository.moveCategory(oldName, name, category.getType());
        if (category.getType() == TransactionType.EXPENSE) {
            budgetRepository.findByCategoryIgnoreCase(oldName).ifPresent(budget -> budget.setCategory(name));
        }
        category.setName(name);
        return toResponse(category);
    }

    /**
     * Deletes a category. If it still has operations, {@code moveTo} names the category of the same type
     * that takes them over.
     */
    @Transactional
    public void delete(Long id, String moveTo) {
        Category category = get(id);
        if (isSystem(category)) {
            throw new IllegalArgumentException("Категорию «" + category.getName() + "» удалить нельзя: на ней держится отдельный раздел");
        }
        long used = transactionRepository.countByCategoryAndType(category.getName(), category.getType());
        if (used > 0) {
            if (moveTo == null || moveTo.isBlank()) {
                throw new IllegalArgumentException("В категории «" + category.getName() + "» " + used + " "
                        + operations(used) + ". Выберите, в какую категорию их перенести.");
            }
            String target = moveTo.trim();
            Category targetCategory = categoryRepository.findAllByOrderByTypeAscNameAsc().stream()
                    .filter(item -> item.getType() == category.getType() && item.getName().equalsIgnoreCase(target))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Категория «" + target + "» не найдена"));
            if (targetCategory.getId().equals(category.getId())) {
                throw new IllegalArgumentException("Выберите другую категорию для переноса");
            }
            if (isSystem(targetCategory)) {
                throw new IllegalArgumentException("В «" + targetCategory.getName() + "» переносить нельзя: там нужны дополнительные поля");
            }
            transactionRepository.moveCategory(category.getName(), targetCategory.getName(), category.getType());
        }
        if (category.getType() == TransactionType.EXPENSE) {
            budgetRepository.findByCategoryIgnoreCase(category.getName()).ifPresent(budgetRepository::delete);
        }
        categoryRepository.delete(category);
    }

    public boolean exists(String name, TransactionType type) {
        return categoryRepository.existsByNameIgnoreCaseAndType(name.trim(), type);
    }

    private Category get(Long id) {
        return categoryRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Категория не найдена"));
    }

    private boolean isSystem(Category category) {
        return category.getType() == TransactionType.EXPENSE
                && SYSTEM_EXPENSE_CATEGORIES.contains(category.getName().toLowerCase(java.util.Locale.ROOT));
    }

    private static String operations(long count) {
        long mod10 = count % 10;
        long mod100 = count % 100;
        if (mod10 == 1 && mod100 != 11) return "операция";
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "операции";
        return "операций";
    }

    private CategoryResponse toResponse(Category category) {
        return new CategoryResponse(category.getId(), category.getName(), category.getType());
    }
}
