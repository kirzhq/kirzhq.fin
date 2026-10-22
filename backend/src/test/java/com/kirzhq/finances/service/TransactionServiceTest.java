package com.kirzhq.finances.service;

import com.kirzhq.finances.domain.Debt;
import com.kirzhq.finances.domain.DebtPayment;
import com.kirzhq.finances.domain.Transaction;
import com.kirzhq.finances.domain.TransactionType;
import com.kirzhq.finances.repository.DebtPaymentRepository;
import com.kirzhq.finances.repository.TransactionRepository;
import com.kirzhq.finances.web.dto.TransactionRequest;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TransactionServiceTest {

    private final TransactionRepository transactions = mock(TransactionRepository.class);
    private final CategoryService categories = mock(CategoryService.class);
    private final DebtPaymentRepository payments = mock(DebtPaymentRepository.class);

    @Test
    void debtPaymentKeepsItsCategory() {
        Debt debt = new Debt();
        debt.setName("TNF Сплит");
        DebtPayment payment = new DebtPayment();
        payment.setDebt(debt);
        when(categories.exists(anyString(), any())).thenReturn(true);
        when(transactions.findById(10L)).thenReturn(Optional.of(new Transaction()));
        when(payments.findByTransactionId(10L)).thenReturn(Optional.of(payment));

        TransactionService service = service(Clock.systemUTC());

        assertThatThrownBy(() -> service.update(10L, request("Еда")))
                .hasMessageContaining("платёж по долгу «TNF Сплит»");
    }

    @Test
    void forecastUsesMoscowDateNotUtc() {
        // 31 October 22:30 UTC is already 1 November in Moscow.
        Clock lateUtc = Clock.fixed(Instant.parse("2026-10-31T22:30:00Z"), ZoneId.of("Europe/Moscow"));
        when(transactions.findAllByTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateDescIdDesc(any(), any()))
                .thenReturn(List.of());

        var november = service(lateUtc).summary(2026, 11);

        assertThat(november.forecastAvailable()).isTrue();
        assertThat(november.calculationDays()).isEqualTo(1);
    }

    private TransactionService service(Clock clock) {
        return new TransactionService(transactions, categories, mock(VehicleService.class), payments, clock);
    }

    private TransactionRequest request(String category) {
        return new TransactionRequest(TransactionType.EXPENSE, category, BigDecimal.TEN, LocalDate.of(2026, 10, 1),
                "", null, null, null, null, "Перекус");
    }
}
