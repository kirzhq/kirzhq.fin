package com.kirzhq.finances.service;

import com.kirzhq.finances.domain.RequiredPayment;
import com.kirzhq.finances.domain.RequiredPaymentTransaction;
import com.kirzhq.finances.domain.Transaction;
import com.kirzhq.finances.domain.TransactionType;
import com.kirzhq.finances.repository.RequiredPaymentRepository;
import com.kirzhq.finances.repository.RequiredPaymentTransactionRepository;
import com.kirzhq.finances.repository.TransactionRepository;
import com.kirzhq.finances.web.dto.RequiredPaymentPayRequest;
import com.kirzhq.finances.web.dto.RequiredPaymentRequest;
import com.kirzhq.finances.web.dto.RequiredPaymentResponse;
import com.kirzhq.finances.web.dto.TransactionRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class RequiredPaymentService {

    /** Operations in these categories need extra fields (vehicle, food subcategory) a monthly payment does not have. */
    private static final Set<String> NOT_ALLOWED = Set.of("машина", "еда");

    private final RequiredPaymentRepository payments;
    private final RequiredPaymentTransactionRepository paid;
    private final TransactionRepository transactions;
    private final TransactionService transactionService;
    private final CategoryService categoryService;
    private final Clock clock;

    public RequiredPaymentService(RequiredPaymentRepository payments, RequiredPaymentTransactionRepository paid,
            TransactionRepository transactions, TransactionService transactionService, CategoryService categoryService, Clock clock) {
        this.payments = payments;
        this.paid = paid;
        this.transactions = transactions;
        this.transactionService = transactionService;
        this.categoryService = categoryService;
        this.clock = clock;
    }

    /** All required payments with their state in the given month. */
    @Transactional(readOnly = true)
    public List<RequiredPaymentResponse> forMonth(int year, int month) {
        YearMonth period = YearMonth.of(year, month);
        Map<Long, RequiredPaymentTransaction> paidById = paid.findAllByPeriod(period.atDay(1)).stream()
                .collect(Collectors.toMap(link -> link.getRequiredPayment().getId(), Function.identity()));
        LocalDate today = LocalDate.now(clock);
        return payments.findAllByOrderByDayOfMonthAscNameAsc().stream()
                .map(payment -> response(payment, period, paidById.get(payment.getId()), today))
                .toList();
    }

    @Transactional
    public RequiredPaymentResponse create(RequiredPaymentRequest request) {
        RequiredPayment payment = new RequiredPayment();
        apply(payment, request);
        return current(payments.save(payment));
    }

    @Transactional
    public RequiredPaymentResponse update(Long id, RequiredPaymentRequest request) {
        RequiredPayment payment = get(id);
        apply(payment, request);
        return current(payments.save(payment));
    }

    /** Deletes the payment; operations that already paid it stay. */
    @Transactional
    public void delete(Long id) {
        payments.delete(get(id));
    }

    /** Creates the expense operation and marks the payment as paid for the requested month. */
    @Transactional
    public RequiredPaymentResponse pay(Long id, RequiredPaymentPayRequest request) {
        RequiredPayment payment = get(id);
        YearMonth period = YearMonth.of(request.year(), request.month());
        if (paid.existsByRequiredPaymentIdAndPeriod(id, period.atDay(1))) {
            throw new IllegalArgumentException("«" + payment.getName() + "» за этот месяц уже оплачен");
        }
        var created = transactionService.create(new TransactionRequest(TransactionType.EXPENSE, payment.getCategory(),
                request.amount(), request.paymentDate(), payment.getName(), null, null, null, null, null, null));
        Transaction transaction = transactions.findById(created.id())
                .orElseThrow(() -> new IllegalStateException("Операция оплаты не создана"));
        RequiredPaymentTransaction link = new RequiredPaymentTransaction();
        link.setRequiredPayment(payment);
        link.setTransaction(transaction);
        link.setPeriod(period.atDay(1));
        paid.save(link);
        return response(payment, period, link, LocalDate.now(clock));
    }

    private RequiredPayment get(Long id) {
        return payments.findById(id).orElseThrow(() -> new IllegalArgumentException("Обязательный платёж не найден"));
    }

    private void apply(RequiredPayment payment, RequiredPaymentRequest request) {
        String category = request.category().trim();
        if (!categoryService.exists(category, TransactionType.EXPENSE)) {
            throw new IllegalArgumentException("Категория расходов «" + category + "» не существует");
        }
        if (NOT_ALLOWED.contains(category.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Для «" + category + "» нужны дополнительные поля, выберите другую категорию");
        }
        payment.setName(request.name().trim());
        payment.setCategory(category);
        payment.setAmount(request.amount());
        payment.setDayOfMonth(request.dayOfMonth());
    }

    private RequiredPaymentResponse current(RequiredPayment payment) {
        LocalDate today = LocalDate.now(clock);
        YearMonth period = YearMonth.from(today);
        RequiredPaymentTransaction link = paid.findAllByPeriod(period.atDay(1)).stream()
                .filter(item -> item.getRequiredPayment().getId().equals(payment.getId()))
                .findFirst().orElse(null);
        return response(payment, period, link, today);
    }

    static RequiredPaymentResponse response(RequiredPayment payment, YearMonth period, RequiredPaymentTransaction link, LocalDate today) {
        // A payment on the 31st falls on the last day of shorter months.
        LocalDate due = period.atDay(Math.min(payment.getDayOfMonth(), period.lengthOfMonth()));
        if (link != null) {
            Transaction transaction = link.getTransaction();
            return new RequiredPaymentResponse(payment.getId(), payment.getName(), payment.getCategory(), payment.getAmount(),
                    payment.getDayOfMonth(), due, "PAID", transaction.getId(), transaction.getAmount(), transaction.getTransactionDate());
        }
        return new RequiredPaymentResponse(payment.getId(), payment.getName(), payment.getCategory(), payment.getAmount(),
                payment.getDayOfMonth(), due, due.isBefore(today) ? "OVERDUE" : "UPCOMING", null, null, null);
    }
}
