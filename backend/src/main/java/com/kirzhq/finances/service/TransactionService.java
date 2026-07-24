package com.kirzhq.finances.service;

import com.kirzhq.finances.domain.Transaction;
import com.kirzhq.finances.domain.TransactionType;
import com.kirzhq.finances.repository.TransactionRepository;
import com.kirzhq.finances.web.dto.SummaryResponse;
import com.kirzhq.finances.web.dto.TransactionRequest;
import com.kirzhq.finances.web.dto.TransactionResponse;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class TransactionService {

    private static final DateTimeFormatter MONTH_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM");

    private final TransactionRepository transactionRepository;

    public TransactionService(TransactionRepository transactionRepository) {
        this.transactionRepository = transactionRepository;
    }

    public List<TransactionResponse> findAll() {
        return transactionRepository.findAll().stream()
                .sorted(Comparator.comparing(Transaction::getTransactionDate).reversed())
                .map(this::toResponse)
                .toList();
    }

    public TransactionResponse create(TransactionRequest request) {
        Transaction transaction = new Transaction();
        applyRequest(transaction, request);
        return toResponse(transactionRepository.save(transaction));
    }

    public SummaryResponse summary() {
        List<Transaction> transactions = transactionRepository.findAll();

        BigDecimal income = transactions.stream()
                .filter(transaction -> transaction.getType() == TransactionType.INCOME)
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal expense = transactions.stream()
                .filter(transaction -> transaction.getType() == TransactionType.EXPENSE)
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, BigDecimal[]> monthly = new LinkedHashMap<>();
        transactions.stream()
                .sorted(Comparator.comparing(Transaction::getTransactionDate))
                .forEach(transaction -> {
                    String month = YearMonth.from(transaction.getTransactionDate()).format(MONTH_FORMATTER);
                    BigDecimal[] values = monthly.computeIfAbsent(month, ignored -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
                    if (transaction.getType() == TransactionType.INCOME) {
                        values[0] = values[0].add(transaction.getAmount());
                    } else {
                        values[1] = values[1].add(transaction.getAmount());
                    }
                });

        Map<String, BigDecimal> categoryPoints = new LinkedHashMap<>();
        transactions.stream()
                .filter(transaction -> transaction.getType() == TransactionType.EXPENSE)
                .forEach(transaction -> categoryPoints.merge(transaction.getCategory(), transaction.getAmount(), BigDecimal::add));

        return new SummaryResponse(
                income,
                expense,
                income.subtract(expense),
                monthly.entrySet().stream()
                        .map(entry -> new SummaryResponse.MonthlyPoint(
                                entry.getKey(),
                                entry.getValue()[0],
                                entry.getValue()[1]))
                        .toList(),
                categoryPoints.entrySet().stream()
                        .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
                        .map(entry -> new SummaryResponse.CategoryPoint(entry.getKey(), entry.getValue()))
                        .toList()
        );
    }

    private void applyRequest(Transaction transaction, TransactionRequest request) {
        transaction.setType(request.type());
        transaction.setCategory(request.category().trim());
        transaction.setAmount(request.amount());
        transaction.setTransactionDate(request.transactionDate());
        transaction.setDescription(request.description().trim());
    }

    private TransactionResponse toResponse(Transaction transaction) {
        return new TransactionResponse(
                transaction.getId(),
                transaction.getType(),
                transaction.getCategory(),
                transaction.getAmount(),
                transaction.getTransactionDate(),
                transaction.getDescription()
        );
    }
}
