package com.kirzhq.finances.service;

import com.kirzhq.finances.domain.Debt;
import com.kirzhq.finances.domain.DebtPayment;
import com.kirzhq.finances.domain.Transaction;
import com.kirzhq.finances.domain.TransactionType;
import com.kirzhq.finances.repository.DebtPaymentRepository;
import com.kirzhq.finances.repository.DebtRepository;
import com.kirzhq.finances.repository.TransactionRepository;
import com.kirzhq.finances.web.dto.DebtPaymentRequest;
import com.kirzhq.finances.web.dto.DebtRequest;
import com.kirzhq.finances.web.dto.DebtResponse;
import com.kirzhq.finances.web.dto.TransactionRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class DebtService {

    private final DebtRepository debts;
    private final DebtPaymentRepository payments;
    private final TransactionRepository transactions;
    private final TransactionService transactionService;

    public DebtService(DebtRepository debts, DebtPaymentRepository payments,
            TransactionRepository transactions, TransactionService transactionService) {
        this.debts = debts;
        this.payments = payments;
        this.transactions = transactions;
        this.transactionService = transactionService;
    }

    @Transactional(readOnly = true)
    public List<DebtResponse> findAll() {
        List<Debt> debtList = debts.findAllByOrderByCreatedDateDescIdDesc();
        if (debtList.isEmpty()) return List.of();
        Map<Long, List<DebtPayment>> paymentsByDebt = payments
                .findAllByDebtIdIn(debtList.stream().map(Debt::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(payment -> payment.getDebt().getId()));
        return debtList.stream()
                .map(debt -> toResponse(debt, paymentsByDebt.getOrDefault(debt.getId(), List.of())))
                .toList();
    }

    @Transactional
    public DebtResponse create(DebtRequest request) {
        Debt debt = new Debt();
        apply(debt, request);
        return toResponse(debts.save(debt));
    }

    @Transactional
    public DebtResponse update(Long id, DebtRequest request) {
        Debt debt = get(id);
        BigDecimal paid = debt.getInitialAmount().subtract(remaining(debt));
        if (request.initialAmount().compareTo(paid) < 0) {
            throw new IllegalArgumentException("Начальная сумма не может быть меньше уже погашенной");
        }
        apply(debt, request);
        return toResponse(debts.save(debt));
    }

    @Transactional
    public void delete(Long id) {
        debts.delete(get(id));
    }

    @Transactional
    public DebtResponse pay(Long id, DebtPaymentRequest request) {
        Debt debt = get(id);
        BigDecimal remaining = remaining(debt);
        if (request.amount().compareTo(remaining) > 0) {
            throw new IllegalArgumentException("Сумма погашения больше остатка долга");
        }
        String comment = request.comment() == null || request.comment().isBlank()
                ? "Погашение долга: " + debt.getName()
                : "Погашение долга: " + debt.getName() + " — " + request.comment().trim();
        var created = transactionService.create(new TransactionRequest(
                TransactionType.EXPENSE, "Долги", request.amount(), request.paymentDate(), comment, null, null, null, null));
        Transaction transaction = transactions.findById(created.id())
                .orElseThrow(() -> new IllegalStateException("Операция погашения не создана"));
        DebtPayment payment = new DebtPayment();
        payment.setDebt(debt);
        payment.setTransaction(transaction);
        payments.save(payment);
        return toResponse(debt);
    }

    private Debt get(Long id) {
        return debts.findById(id).orElseThrow(() -> new IllegalArgumentException("Долг не найден"));
    }

    private void apply(Debt debt, DebtRequest request) {
        debt.setName(request.name().trim());
        debt.setInitialAmount(request.initialAmount());
        debt.setCreatedDate(request.createdDate());
        debt.setNote(request.note() == null ? "" : request.note().trim());
    }

    private BigDecimal remaining(Debt debt) {
        BigDecimal paid = payments.findAllByDebtId(debt.getId()).stream()
                .map(payment -> payment.getTransaction().getAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return debt.getInitialAmount().subtract(paid).max(BigDecimal.ZERO);
    }

    private DebtResponse toResponse(Debt debt) {
        return toResponse(debt, payments.findAllByDebtId(debt.getId()));
    }

    private DebtResponse toResponse(Debt debt, List<DebtPayment> paymentsForDebt) {
        List<DebtPayment> debtPayments = paymentsForDebt.stream()
                .sorted(Comparator.comparing((DebtPayment payment) -> payment.getTransaction().getTransactionDate())
                        .thenComparing(payment -> payment.getTransaction().getId()).reversed())
                .toList();
        BigDecimal paid = debtPayments.stream()
                .map(payment -> payment.getTransaction().getAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal remaining = debt.getInitialAmount().subtract(paid).max(BigDecimal.ZERO);
        int progress = debt.getInitialAmount().signum() == 0 ? 0
                : paid.min(debt.getInitialAmount()).multiply(BigDecimal.valueOf(100))
                        .divide(debt.getInitialAmount(), 0, RoundingMode.HALF_UP).intValue();
        return new DebtResponse(
                debt.getId(), debt.getName(), debt.getInitialAmount(), paid, remaining, progress,
                debt.getCreatedDate(), debt.getNote(),
                debtPayments.stream().map(payment -> new DebtResponse.Payment(
                        payment.getId(),
                        payment.getTransaction().getId(),
                        payment.getTransaction().getAmount(),
                        payment.getTransaction().getTransactionDate(),
                        payment.getTransaction().getDescription()
                )).toList()
        );
    }
}
