package com.kirzhq.finances.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "savings_entries")
public class SavingsEntry {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "goal_id", nullable = false)
    private SavingsGoal goal;
    @Column(nullable = false) private BigDecimal amount;
    @Column(name = "entry_date", nullable = false) private LocalDate entryDate;
    @Column(nullable = false) private String comment = "";

    public Long getId() { return id; }
    public SavingsGoal getGoal() { return goal; }
    public void setGoal(SavingsGoal goal) { this.goal = goal; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public LocalDate getEntryDate() { return entryDate; }
    public void setEntryDate(LocalDate entryDate) { this.entryDate = entryDate; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
}
