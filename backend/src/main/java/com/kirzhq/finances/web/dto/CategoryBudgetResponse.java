package com.kirzhq.finances.web.dto;

import java.math.BigDecimal;

public record CategoryBudgetResponse(Long id, String category, BigDecimal monthlyLimit) {}
