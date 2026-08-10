package com.kirzhq.finances.web.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record SavingsGoalRequest(
        @NotBlank @Size(max = 255) String name,
        @NotNull @DecimalMin("0.01") BigDecimal targetAmount,
        LocalDate targetDate,
        @NotNull LocalDate createdDate,
        @Size(max = 1000) String note,
        @Pattern(regexp = "^#[0-9a-fA-F]{6}$") String color) {}
