package com.kirzhq.finances.config;

import com.kirzhq.finances.domain.Transaction;
import com.kirzhq.finances.domain.TransactionType;
import com.kirzhq.finances.repository.TransactionRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Configuration
public class DemoDataConfig {

    @Bean
    CommandLineRunner seedDemoTransactions(TransactionRepository transactionRepository) {
        return args -> {
            if (transactionRepository.count() > 0) {
                return;
            }

            transactionRepository.saveAll(List.of(
                    transaction(TransactionType.INCOME, "Salary", "5800.00", LocalDate.now().minusMonths(2).withDayOfMonth(1), "Monthly salary"),
                    transaction(TransactionType.EXPENSE, "Rent", "1800.00", LocalDate.now().minusMonths(2).withDayOfMonth(3), "Apartment rent"),
                    transaction(TransactionType.EXPENSE, "Food", "420.50", LocalDate.now().minusMonths(2).withDayOfMonth(6), "Groceries and cafes"),
                    transaction(TransactionType.INCOME, "Freelance", "1100.00", LocalDate.now().minusMonths(1).withDayOfMonth(11), "Client design work"),
                    transaction(TransactionType.EXPENSE, "Transport", "165.00", LocalDate.now().minusMonths(1).withDayOfMonth(12), "Fuel and transit"),
                    transaction(TransactionType.EXPENSE, "Food", "510.20", LocalDate.now().minusMonths(1).withDayOfMonth(18), "Groceries"),
                    transaction(TransactionType.INCOME, "Salary", "5800.00", LocalDate.now().withDayOfMonth(1), "Monthly salary"),
                    transaction(TransactionType.EXPENSE, "Rent", "1800.00", LocalDate.now().withDayOfMonth(3), "Apartment rent"),
                    transaction(TransactionType.EXPENSE, "Utilities", "240.75", LocalDate.now().withDayOfMonth(8), "Internet and power"),
                    transaction(TransactionType.EXPENSE, "Food", "460.90", LocalDate.now().withDayOfMonth(10), "Groceries and dining")
            ));
        };
    }

    private Transaction transaction(TransactionType type, String category, String amount, LocalDate date, String description) {
        Transaction transaction = new Transaction();
        transaction.setType(type);
        transaction.setCategory(category);
        transaction.setAmount(new BigDecimal(amount));
        transaction.setTransactionDate(date);
        transaction.setDescription(description);
        return transaction;
    }
}
