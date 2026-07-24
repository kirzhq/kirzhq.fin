package com.kirzhq.finances.service;

import com.kirzhq.finances.domain.Category;
import com.kirzhq.finances.repository.CategoryRepository;
import com.kirzhq.finances.web.dto.CategoryRequest;
import com.kirzhq.finances.web.dto.CategoryResponse;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    public List<CategoryResponse> findAll() {
        return categoryRepository.findAllByOrderByTypeAscNameAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    public CategoryResponse create(CategoryRequest request) {
        String name = request.name().trim();
        if (categoryRepository.existsByNameIgnoreCaseAndType(name, request.type())) {
            throw new DataIntegrityViolationException("Такая категория уже существует");
        }

        Category category = new Category();
        category.setName(name);
        category.setType(request.type());
        return toResponse(categoryRepository.save(category));
    }

    public boolean exists(String name, com.kirzhq.finances.domain.TransactionType type) {
        return categoryRepository.existsByNameIgnoreCaseAndType(name.trim(), type);
    }

    private CategoryResponse toResponse(Category category) {
        return new CategoryResponse(category.getId(), category.getName(), category.getType());
    }
}
