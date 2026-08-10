package com.kirzhq.finances.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "savings_goals")
public class SavingsGoal {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private String name;
    @Column(name = "target_amount", nullable = false) private BigDecimal targetAmount;
    @Column(name = "target_date") private LocalDate targetDate;
    @Column(name = "created_date", nullable = false) private LocalDate createdDate;
    @Column(nullable = false) private String note = "";
    @Column(nullable = false, length = 7) private String color = "#6c5ce7";

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public BigDecimal getTargetAmount() { return targetAmount; }
    public void setTargetAmount(BigDecimal targetAmount) { this.targetAmount = targetAmount; }
    public LocalDate getTargetDate() { return targetDate; }
    public void setTargetDate(LocalDate targetDate) { this.targetDate = targetDate; }
    public LocalDate getCreatedDate() { return createdDate; }
    public void setCreatedDate(LocalDate createdDate) { this.createdDate = createdDate; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
}
