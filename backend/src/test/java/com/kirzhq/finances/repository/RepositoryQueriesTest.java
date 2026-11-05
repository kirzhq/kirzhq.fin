package com.kirzhq.finances.repository;

import com.kirzhq.finances.domain.Debt;
import com.kirzhq.finances.domain.DebtPayment;
import com.kirzhq.finances.domain.Transaction;
import com.kirzhq.finances.domain.TransactionType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Checks that the hand-written queries parse and do what the services expect. Schema comes from the entities. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
@TestPropertySource(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
class RepositoryQueriesTest {

    @Autowired TransactionRepository transactions;
    @Autowired DebtRepository debts;
    @Autowired DebtPaymentRepository payments;

    @Test
    void movesOperationsBetweenCategoriesOfOneType() {
        transactions.save(transaction(TransactionType.EXPENSE, "ННТ"));
        transactions.save(transaction(TransactionType.EXPENSE, "ННТ"));
        transactions.save(transaction(TransactionType.INCOME, "ННТ"));

        assertThat(transactions.countByCategoryAndType("ННТ", TransactionType.EXPENSE)).isEqualTo(2);
        assertThat(transactions.moveCategory("ННТ", "Прочее", TransactionType.EXPENSE)).isEqualTo(2);
        assertThat(transactions.countByCategoryAndType("ННТ", TransactionType.INCOME)).isEqualTo(1);
    }

    @Test
    void periodQueryCanSkipOperationsLeftOutOfTotals() {
        Transaction kept = transactions.save(transaction(TransactionType.EXPENSE, "Машина"));
        Transaction history = transaction(TransactionType.EXPENSE, "Машина");
        history.setExcludedFromTotals(true);
        transactions.save(history);
        LocalDate from = LocalDate.of(2026, 10, 1);
        LocalDate to = LocalDate.of(2026, 11, 1);

        assertThat(transactions.findAllByExcludedFromTotalsFalseAndTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateDescIdDesc(from, to))
                .extracting(Transaction::getId).containsExactly(kept.getId());
        assertThat(transactions.findAllByTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateDescIdDesc(from, to)).hasSize(2);
    }

    @Test
    void findsDebtNamesOfPayments() {
        Debt debt = new Debt();
        debt.setName("TNF Сплит");
        debt.setInitialAmount(new BigDecimal("11849"));
        debt.setCreatedDate(LocalDate.of(2026, 8, 25));
        debt.setNote("");
        debt.setDueDate(LocalDate.of(2026, 12, 25));
        debts.save(debt);
        Transaction paid = transactions.save(transaction(TransactionType.EXPENSE, "Долги"));
        Transaction other = transactions.save(transaction(TransactionType.EXPENSE, "Еда"));
        DebtPayment payment = new DebtPayment();
        payment.setDebt(debt);
        payment.setTransaction(paid);
        payments.save(payment);

        List<DebtPaymentRepository.TransactionDebt> names = payments.findDebtNames(List.of(paid.getId(), other.getId()));

        assertThat(names).singleElement().satisfies(row -> {
            assertThat(row.getTransactionId()).isEqualTo(paid.getId());
            assertThat(row.getDebtName()).isEqualTo("TNF Сплит");
        });
        assertThat(payments.findByTransactionId(paid.getId())).get().extracting(item -> item.getDebt().getName()).isEqualTo("TNF Сплит");
        assertThat(payments.findByTransactionId(other.getId())).isEmpty();
    }

    private Transaction transaction(TransactionType type, String category) {
        Transaction transaction = new Transaction();
        transaction.setType(type);
        transaction.setCategory(category);
        transaction.setAmount(new BigDecimal("100.00"));
        transaction.setTransactionDate(LocalDate.of(2026, 10, 1));
        transaction.setDescription("");
        return transaction;
    }
}
