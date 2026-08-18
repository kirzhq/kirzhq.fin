package com.kirzhq.finances.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

public record CategoryBudgetRequest(
        @NotBlank String category,
        @DecimalMin(value = "0.01") BigDecimal monthlyLimit
) {}
