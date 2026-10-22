package com.kirzhq.finances.service;

import com.kirzhq.finances.domain.Category;
import com.kirzhq.finances.domain.CategoryBudget;
import com.kirzhq.finances.domain.TransactionType;
import com.kirzhq.finances.repository.CategoryBudgetRepository;
import com.kirzhq.finances.repository.CategoryRepository;
import com.kirzhq.finances.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CategoryServiceTest {

    private CategoryRepository categories;
    private TransactionRepository transactions;
    private CategoryBudgetRepository budgets;
    private CategoryService service;

    @BeforeEach
    void setUp() {
        categories = mock(CategoryRepository.class);
        transactions = mock(TransactionRepository.class);
        budgets = mock(CategoryBudgetRepository.class);
        service = new CategoryService(categories, transactions, budgets);
    }

    @Test
    void renameMovesOperationsAndBudget() {
        Category taxi = category(5L, "Такси", TransactionType.EXPENSE);
        CategoryBudget budget = new CategoryBudget();
        budget.setCategory("Такси");
        budget.setMonthlyLimit(BigDecimal.TEN);
        when(categories.findById(5L)).thenReturn(Optional.of(taxi));
        when(budgets.findByCategoryIgnoreCase("Такси")).thenReturn(Optional.of(budget));

        var renamed = service.rename(5L, "  Такси/самики ");

        assertThat(renamed.name()).isEqualTo("Такси/самики");
        assertThat(budget.getCategory()).isEqualTo("Такси/самики");
        verify(transactions).moveCategory("Такси", "Такси/самики", TransactionType.EXPENSE);
    }

    @Test
    void systemCategoriesCannotBeRenamedOrDeleted() {
        when(categories.findById(1L)).thenReturn(Optional.of(category(1L, "Долги", TransactionType.EXPENSE)));

        assertThatThrownBy(() -> service.rename(1L, "Кредиты")).hasMessageContaining("переименовать нельзя");
        assertThatThrownBy(() -> service.delete(1L, null)).hasMessageContaining("удалить нельзя");
        verify(transactions, never()).moveCategory(anyString(), anyString(), any());
    }

    @Test
    void deleteWithOperationsNeedsTarget() {
        when(categories.findById(7L)).thenReturn(Optional.of(category(7L, "ННТ", TransactionType.EXPENSE)));
        when(transactions.countByCategoryAndType("ННТ", TransactionType.EXPENSE)).thenReturn(5L);

        assertThatThrownBy(() -> service.delete(7L, null)).hasMessageContaining("5 операций");
        verify(categories, never()).delete(any());
    }

    @Test
    void deleteMovesOperationsToTarget() {
        Category old = category(7L, "ННТ", TransactionType.EXPENSE);
        Category other = category(8L, "Прочее", TransactionType.EXPENSE);
        when(categories.findById(7L)).thenReturn(Optional.of(old));
        when(categories.findAllByOrderByTypeAscNameAsc()).thenReturn(List.of(old, other));
        when(transactions.countByCategoryAndType("ННТ", TransactionType.EXPENSE)).thenReturn(5L);

        service.delete(7L, "прочее");

        verify(transactions).moveCategory("ННТ", "Прочее", TransactionType.EXPENSE);
        verify(categories).delete(old);
    }

    @Test
    void duplicateNameIsRejectedWithReadableMessage() {
        when(categories.existsByNameIgnoreCaseAndType("Еда", TransactionType.EXPENSE)).thenReturn(true);

        assertThatThrownBy(() -> service.create(new com.kirzhq.finances.web.dto.CategoryRequest("Еда", TransactionType.EXPENSE)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Категория «Еда» уже есть");
    }

    private Category category(Long id, String name, TransactionType type) {
        Category category = new Category();
        ReflectionTestUtils.setField(category, "id", id);
        category.setName(name);
        category.setType(type);
        return category;
    }
}
