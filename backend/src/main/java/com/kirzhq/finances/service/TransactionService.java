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
    private final CategoryService categoryService;
    private final VehicleService vehicleService;

    public TransactionService(TransactionRepository transactionRepository, CategoryService categoryService, VehicleService vehicleService) {
        this.transactionRepository = transactionRepository;
        this.categoryService = categoryService;
        this.vehicleService = vehicleService;
    }

    public List<TransactionResponse> findAll(int year, Integer month) {
        return transactionRepository.findAll().stream()
                .filter(transaction -> transaction.getTransactionDate().getYear() == year)
                .filter(transaction -> month == null || transaction.getTransactionDate().getMonthValue() == month)
                .sorted(Comparator.comparing(Transaction::getTransactionDate).reversed())
                .map(this::toResponse)
                .toList();
    }

    public TransactionResponse create(TransactionRequest request) {
        if (!categoryService.exists(request.category(), request.type())) {
            throw new IllegalArgumentException("Выбранная категория не существует");
        }
        Transaction transaction = new Transaction();
        applyRequest(transaction, request);
        return toResponse(transactionRepository.save(transaction));
    }

    public TransactionResponse update(Long id, TransactionRequest request) {
        if (!categoryService.exists(request.category(), request.type())) {
            throw new IllegalArgumentException("Выбранная категория не существует");
        }
        Transaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Операция не найдена"));
        applyRequest(transaction, request);
        return toResponse(transactionRepository.save(transaction));
    }

    public void delete(Long id) {
        if (!transactionRepository.existsById(id)) {
            throw new IllegalArgumentException("Операция не найдена");
        }
        transactionRepository.deleteById(id);
    }

    public SummaryResponse summary(int year, Integer month) {
        List<Transaction> transactions = transactionRepository.findAll().stream()
                .filter(transaction -> transaction.getTransactionDate().getYear() == year)
                .filter(transaction -> month == null || transaction.getTransactionDate().getMonthValue() == month)
                .toList();

        BigDecimal income = transactions.stream()
                .filter(transaction -> transaction.getType() == TransactionType.INCOME)
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal expense = transactions.stream()
                .filter(transaction -> transaction.getType() == TransactionType.EXPENSE)
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, BigDecimal[]> monthly = new LinkedHashMap<>();
        if (month == null) {
            for (int monthNumber = 1; monthNumber <= 12; monthNumber++) {
                monthly.put(YearMonth.of(year, monthNumber).format(MONTH_FORMATTER),
                        new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            }
        }
        transactions.stream()
                .sorted(Comparator.comparing(Transaction::getTransactionDate))
                .forEach(transaction -> {
                    String monthKey = YearMonth.from(transaction.getTransactionDate()).format(MONTH_FORMATTER);
                    BigDecimal[] values = monthly.computeIfAbsent(monthKey, ignored -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
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
        transaction.setDescription(request.description() == null ? "" : request.description().trim());
        transaction.setVehicle("Машина".equalsIgnoreCase(request.category())
                ? vehicleService.get(request.vehicleId())
                : null);
    }

    private TransactionResponse toResponse(Transaction transaction) {
        return new TransactionResponse(
                transaction.getId(),
                transaction.getType(),
                transaction.getCategory(),
                transaction.getAmount(),
                transaction.getTransactionDate(),
                transaction.getDescription(),
                transaction.getVehicle() == null ? null : transaction.getVehicle().getId(),
                transaction.getVehicle() == null ? null : transaction.getVehicle().getName()
        );
    }
}
