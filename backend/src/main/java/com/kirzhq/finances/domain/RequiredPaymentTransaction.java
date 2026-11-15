package com.kirzhq.finances.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

import java.time.LocalDate;

/** Marks a required payment as paid for one month by the operation that paid it. */
@Entity
@Table(name = "required_payment_transactions")
public class RequiredPaymentTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "required_payment_id", nullable = false)
    private RequiredPayment requiredPayment;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "transaction_id", nullable = false, unique = true)
    private Transaction transaction;

    /** First day of the month this payment closes. */
    @Column(nullable = false)
    private LocalDate period;

    public Long getId() { return id; }
    public RequiredPayment getRequiredPayment() { return requiredPayment; }
    public void setRequiredPayment(RequiredPayment requiredPayment) { this.requiredPayment = requiredPayment; }
    public Transaction getTransaction() { return transaction; }
    public void setTransaction(Transaction transaction) { this.transaction = transaction; }
    public LocalDate getPeriod() { return period; }
    public void setPeriod(LocalDate period) { this.period = period; }
}
