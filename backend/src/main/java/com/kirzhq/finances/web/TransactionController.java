package com.kirzhq.finances.web;

import com.kirzhq.finances.service.TransactionService;
import com.kirzhq.finances.web.dto.SummaryResponse;
import com.kirzhq.finances.web.dto.TransactionRequest;
import com.kirzhq.finances.web.dto.TransactionResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.util.List;

@RestController
@RequestMapping("/api")
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @GetMapping("/transactions")
    public List<TransactionResponse> transactions(
            @RequestParam(defaultValue = "2026") int year,
            @RequestParam(required = false) Integer month
    ) {
        return transactionService.findAll(year, month);
    }

    @PostMapping("/transactions")
    public TransactionResponse create(@Valid @RequestBody TransactionRequest request) {
        return transactionService.create(request);
    }

    @PutMapping("/transactions/{id}")
    public TransactionResponse update(@PathVariable Long id, @Valid @RequestBody TransactionRequest request) {
        return transactionService.update(id, request);
    }

    @DeleteMapping("/transactions/{id}")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        transactionService.delete(id);
    }

    @GetMapping("/summary")
    public SummaryResponse summary(
            @RequestParam(defaultValue = "2026") int year,
            @RequestParam(required = false) Integer month
    ) {
        return transactionService.summary(year, month);
    }
}
