package com.kirzhq.finances.web;

import com.kirzhq.finances.service.TransactionService;
import com.kirzhq.finances.web.dto.SummaryResponse;
import com.kirzhq.finances.web.dto.TransactionRequest;
import com.kirzhq.finances.web.dto.TransactionResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @GetMapping("/transactions")
    public List<TransactionResponse> transactions() {
        return transactionService.findAll();
    }

    @PostMapping("/transactions")
    public TransactionResponse create(@Valid @RequestBody TransactionRequest request) {
        return transactionService.create(request);
    }

    @GetMapping("/summary")
    public SummaryResponse summary() {
        return transactionService.summary();
    }
}
