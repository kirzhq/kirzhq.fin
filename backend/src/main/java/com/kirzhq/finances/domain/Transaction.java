package com.kirzhq.finances.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "transactions")
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TransactionType type;

    @Column(nullable = false)
    private String category;

    @Column(name = "food_subcategory")
    private String foodSubcategory;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false)
    private LocalDate transactionDate;

    @Column(nullable = false)
    private String description;

    @ManyToOne
    @JoinColumn(name = "vehicle_id")
    private Vehicle vehicle;

    @Enumerated(EnumType.STRING)
    @Column(name = "vehicle_expense_type")
    private VehicleExpenseType vehicleExpenseType;

    @Column(name = "odometer_km")
    private Long odometerKm;

    @Column(name = "fuel_liters", precision = 10, scale = 3)
    private BigDecimal fuelLiters;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public TransactionType getType() {
        return type;
    }

    public void setType(TransactionType type) {
        this.type = type;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getFoodSubcategory() {
        return foodSubcategory;
    }

    public void setFoodSubcategory(String foodSubcategory) {
        this.foodSubcategory = foodSubcategory;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public LocalDate getTransactionDate() {
        return transactionDate;
    }

    public void setTransactionDate(LocalDate transactionDate) {
        this.transactionDate = transactionDate;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Vehicle getVehicle() {
        return vehicle;
    }

    public void setVehicle(Vehicle vehicle) {
        this.vehicle = vehicle;
    }

    public VehicleExpenseType getVehicleExpenseType() {
        return vehicleExpenseType;
    }

    public void setVehicleExpenseType(VehicleExpenseType vehicleExpenseType) {
        this.vehicleExpenseType = vehicleExpenseType;
    }

    public Long getOdometerKm() {
        return odometerKm;
    }

    public void setOdometerKm(Long odometerKm) {
        this.odometerKm = odometerKm;
    }

    public BigDecimal getFuelLiters() {
        return fuelLiters;
    }

    public void setFuelLiters(BigDecimal fuelLiters) {
        this.fuelLiters = fuelLiters;
    }
}
