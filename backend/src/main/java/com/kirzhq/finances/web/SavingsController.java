package com.kirzhq.finances.web;

import com.kirzhq.finances.service.SavingsService;
import com.kirzhq.finances.web.dto.SavingsEntryRequest;
import com.kirzhq.finances.web.dto.SavingsGoalRequest;
import com.kirzhq.finances.web.dto.SavingsGoalResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/savings")
public class SavingsController {
    private final SavingsService service;
    public SavingsController(SavingsService service) { this.service = service; }

    @GetMapping public List<SavingsGoalResponse> findAll() { return service.findAll(); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public SavingsGoalResponse create(@Valid @RequestBody SavingsGoalRequest request) { return service.create(request); }
    @PutMapping("/{id}")
    public SavingsGoalResponse update(@PathVariable Long id, @Valid @RequestBody SavingsGoalRequest request) { return service.update(id, request); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) { service.delete(id); }
    @PostMapping("/{id}/entries") @ResponseStatus(HttpStatus.CREATED)
    public SavingsGoalResponse addEntry(@PathVariable Long id, @Valid @RequestBody SavingsEntryRequest request) { return service.addEntry(id, request); }
    @DeleteMapping("/{goalId}/entries/{entryId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteEntry(@PathVariable Long goalId, @PathVariable Long entryId) { service.deleteEntry(goalId, entryId); }
}
