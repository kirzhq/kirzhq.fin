package com.kirzhq.finances.service;

import com.kirzhq.finances.domain.RequiredPayment;
import com.kirzhq.finances.domain.RequiredPaymentTransaction;
import com.kirzhq.finances.domain.Transaction;
import com.kirzhq.finances.repository.RequiredPaymentRepository;
import com.kirzhq.finances.repository.RequiredPaymentTransactionRepository;
import com.kirzhq.finances.repository.TransactionRepository;
import com.kirzhq.finances.web.dto.RequiredPaymentPayRequest;
import com.kirzhq.finances.web.dto.RequiredPaymentRequest;
import com.kirzhq.finances.web.dto.RequiredPaymentResponse;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RequiredPaymentServiceTest {

    private final RequiredPaymentRepository payments = mock(RequiredPaymentRepository.class);
    private final RequiredPaymentTransactionRepository paid = mock(RequiredPaymentTransactionRepository.class);
    private final TransactionService transactionService = mock(TransactionService.class);
    private final CategoryService categories = mock(CategoryService.class);
    // 15 November 2026 in Moscow.
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-15T09:00:00Z"), ZoneId.of("Europe/Moscow"));
    private final RequiredPaymentService service = new RequiredPaymentService(payments, paid, mock(TransactionRepository.class),
            transactionService, categories, clock);

    @Test
    void statusDependsOnDueDateAndPayment() {
        RequiredPayment rent = payment(1L, "Аренда", 5);
        RequiredPayment internet = payment(2L, "Интернет", 20);
        RequiredPayment phone = payment(3L, "Связь", 10);
        when(payments.findAllByOrderByDayOfMonthAscNameAsc()).thenReturn(List.of(rent, phone, internet));
        when(paid.findAllByPeriod(LocalDate.of(2026, 11, 1))).thenReturn(List.of(link(phone, 77L, LocalDate.of(2026, 11, 9))));

        List<RequiredPaymentResponse> november = service.forMonth(2026, 11);

        assertThat(november).extracting(RequiredPaymentResponse::status).containsExactly("OVERDUE", "PAID", "UPCOMING");
        assertThat(november.get(1).transactionId()).isEqualTo(77L);
        assertThat(november.get(1).paidDate()).isEqualTo(LocalDate.of(2026, 11, 9));
    }

    @Test
    void dayAfterMonthEndFallsOnLastDay() {
        RequiredPaymentResponse february = RequiredPaymentService.response(payment(1L, "Аренда", 31), YearMonth.of(2027, 2), null,
                LocalDate.of(2026, 11, 15));

        assertThat(february.dueDate()).isEqualTo(LocalDate.of(2027, 2, 28));
        assertThat(february.status()).isEqualTo("UPCOMING");
    }

    @Test
    void cannotPayTheSameMonthTwice() {
        when(payments.findById(1L)).thenReturn(Optional.of(payment(1L, "Аренда", 5)));
        when(paid.existsByRequiredPaymentIdAndPeriod(1L, LocalDate.of(2026, 11, 1))).thenReturn(true);

        assertThatThrownBy(() -> service.pay(1L, new RequiredPaymentPayRequest(2026, 11, BigDecimal.TEN, LocalDate.of(2026, 11, 15))))
                .hasMessageContaining("уже оплачен");
        verify(transactionService, never()).create(any());
    }

    @Test
    void rejectsCategoriesThatNeedExtraFields() {
        when(categories.exists(anyString(), any())).thenReturn(true);

        assertThatThrownBy(() -> service.create(new RequiredPaymentRequest("Страховка", "Машина", BigDecimal.TEN, 3)))
                .hasMessageContaining("выберите другую категорию");
    }

    private static RequiredPayment payment(Long id, String name, int day) {
        RequiredPayment payment = new RequiredPayment();
        ReflectionTestUtils.setField(payment, "id", id);
        payment.setName(name);
        payment.setCategory("Жильё");
        payment.setAmount(new BigDecimal("1000"));
        payment.setDayOfMonth(day);
        return payment;
    }

    private static RequiredPaymentTransaction link(RequiredPayment payment, Long transactionId, LocalDate date) {
        Transaction transaction = new Transaction();
        ReflectionTestUtils.setField(transaction, "id", transactionId);
        transaction.setAmount(payment.getAmount());
        transaction.setTransactionDate(date);
        RequiredPaymentTransaction link = new RequiredPaymentTransaction();
        link.setRequiredPayment(payment);
        link.setTransaction(transaction);
        link.setPeriod(date.withDayOfMonth(1));
        return link;
    }
}
