package com.kirzhq.finances.web;

import com.kirzhq.finances.service.DebtService;
import com.kirzhq.finances.web.dto.DebtPaymentRequest;
import com.kirzhq.finances.web.dto.DebtRequest;
import com.kirzhq.finances.web.dto.DebtResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/debts")
public class DebtController {

    private final DebtService service;

    public DebtController(DebtService service) {
        this.service = service;
    }

    @GetMapping
    public List<DebtResponse> findAll() {
        return service.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DebtResponse create(@Valid @RequestBody DebtRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public DebtResponse update(@PathVariable Long id, @Valid @RequestBody DebtRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    @PostMapping("/{id}/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public DebtResponse pay(@PathVariable Long id, @Valid @RequestBody DebtPaymentRequest request) {
        return service.pay(id, request);
    }
}
