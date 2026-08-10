package com.kirzhq.finances.web.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record SavingsEntryRequest(
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        @NotNull LocalDate entryDate,
        @Size(max = 500) String comment,
        boolean withdrawal) {}
