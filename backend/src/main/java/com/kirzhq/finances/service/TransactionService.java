package com.kirzhq.finances.service;

import com.kirzhq.finances.domain.Transaction;
import com.kirzhq.finances.domain.TransactionType;
import com.kirzhq.finances.domain.VehicleExpenseType;
import com.kirzhq.finances.repository.TransactionRepository;
import com.kirzhq.finances.web.dto.SummaryResponse;
import com.kirzhq.finances.web.dto.TransactionRequest;
import com.kirzhq.finances.web.dto.TransactionResponse;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class TransactionService {

    private static final DateTimeFormatter MONTH_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final List<String> FOOD_SUBCATEGORIES = List.of(
            "Доставка из ресторанов", "Доставка из магазина", "Ресторан", "Перекус", "Готовая еда", "Продукты");

    private final TransactionRepository transactionRepository;
    private final CategoryService categoryService;
    private final VehicleService vehicleService;

    public TransactionService(TransactionRepository transactionRepository, CategoryService categoryService, VehicleService vehicleService) {
        this.transactionRepository = transactionRepository;
        this.categoryService = categoryService;
        this.vehicleService = vehicleService;
    }

    public List<TransactionResponse> findAll(int year, Integer month) {
        return transactionsForPeriod(year, month).stream()
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
        List<Transaction> transactions = transactionsForPeriod(year, month);

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

        BigDecimal foodExpense = transactions.stream()
                .filter(transaction -> transaction.getType() == TransactionType.EXPENSE)
                .filter(transaction -> "Еда".equals(transaction.getCategory()))
                .map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        int calculationDays = calculationDays(year, month);
        boolean forecastAvailable = month != null && YearMonth.of(year, month).equals(YearMonth.now());
        int daysInMonth = month == null ? 0 : YearMonth.of(year, month).lengthOfMonth();
        BigDecimal projectedExpense = forecastAvailable
                ? averagePerDay(expense, calculationDays).multiply(BigDecimal.valueOf(daysInMonth)).setScale(2, RoundingMode.HALF_UP)
                : expense;

        return new SummaryResponse(
                income,
                expense,
                income.subtract(expense),
                averagePerDay(expense, calculationDays),
                foodExpense,
                averagePerDay(foodExpense, calculationDays),
                calculationDays,
                projectedExpense,
                income.subtract(projectedExpense),
                daysInMonth,
                forecastAvailable,
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

    private int calculationDays(int year, Integer month) {
        if (month == null) {
            return 0;
        }
        YearMonth selected = YearMonth.of(year, month);
        YearMonth current = YearMonth.now();
        return selected.equals(current) ? LocalDate.now().getDayOfMonth() : selected.lengthOfMonth();
    }

    private BigDecimal averagePerDay(BigDecimal amount, int days) {
        return days == 0 ? BigDecimal.ZERO : amount.divide(BigDecimal.valueOf(days), 2, RoundingMode.HALF_UP);
    }

    private void applyRequest(Transaction transaction, TransactionRequest request) {
        boolean vehicleExpense = "Машина".equalsIgnoreCase(request.category());
        VehicleExpenseType vehicleExpenseType = vehicleExpense
                ? (request.vehicleExpenseType() == null ? VehicleExpenseType.OTHER : request.vehicleExpenseType())
                : null;
        if (request.odometerKm() != null && request.odometerKm() <= 0) {
            throw new IllegalArgumentException("Пробег должен быть больше нуля");
        }
        if (request.odometerKm() != null && vehicleExpenseType != VehicleExpenseType.FUEL) {
            throw new IllegalArgumentException("Пробег можно указать только для расхода на бензин");
        }
        if (request.fuelLiters() != null && request.fuelLiters().signum() <= 0) {
            throw new IllegalArgumentException("Объём топлива должен быть больше нуля");
        }
        if (request.fuelLiters() != null && vehicleExpenseType != VehicleExpenseType.FUEL) {
            throw new IllegalArgumentException("Объём топлива можно указать только для расхода на бензин");
        }
        transaction.setType(request.type());
        transaction.setCategory(request.category().trim());
        if ("Еда".equalsIgnoreCase(request.category())) {
            String subcategory = request.foodSubcategory() == null ? "Перекус" : request.foodSubcategory().trim();
            if (!FOOD_SUBCATEGORIES.contains(subcategory)) {
                throw new IllegalArgumentException("Выбранная подкатегория еды не существует");
            }
            transaction.setFoodSubcategory(subcategory);
        } else {
            transaction.setFoodSubcategory(null);
        }
        transaction.setAmount(request.amount());
        transaction.setTransactionDate(request.transactionDate());
        transaction.setDescription(request.description() == null ? "" : request.description().trim());
        transaction.setVehicle(vehicleExpense ? vehicleService.get(request.vehicleId()) : null);
        transaction.setVehicleExpenseType(vehicleExpenseType);
        transaction.setOdometerKm(vehicleExpenseType == VehicleExpenseType.FUEL ? request.odometerKm() : null);
        transaction.setFuelLiters(vehicleExpenseType == VehicleExpenseType.FUEL ? request.fuelLiters() : null);
    }

    private List<Transaction> transactionsForPeriod(int year, Integer month) {
        LocalDate from = month == null ? LocalDate.of(year, 1, 1) : LocalDate.of(year, month, 1);
        LocalDate to = month == null ? from.plusYears(1) : from.plusMonths(1);
        return transactionRepository
                .findAllByTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateDescIdDesc(from, to);
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
                transaction.getVehicle() == null ? null : transaction.getVehicle().getName(),
                transaction.getVehicleExpenseType(),
                transaction.getOdometerKm(),
                transaction.getFuelLiters(),
                transaction.getFoodSubcategory()
        );
    }
}
