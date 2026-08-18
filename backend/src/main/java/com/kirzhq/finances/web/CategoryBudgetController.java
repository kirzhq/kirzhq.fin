package com.kirzhq.finances.web;

import com.kirzhq.finances.service.CategoryBudgetService;
import com.kirzhq.finances.web.dto.CategoryBudgetRequest;
import com.kirzhq.finances.web.dto.CategoryBudgetResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/budgets")
public class CategoryBudgetController {
    private final CategoryBudgetService service;

    public CategoryBudgetController(CategoryBudgetService service) { this.service = service; }

    @GetMapping
    public List<CategoryBudgetResponse> findAll() { return service.findAll(); }

    @PutMapping
    public CategoryBudgetResponse save(@Valid @RequestBody CategoryBudgetRequest request) { return service.save(request); }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) { service.delete(id); }
}
