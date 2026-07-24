package com.kirzhq.finances.web.dto;

import com.kirzhq.finances.domain.TransactionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CategoryRequest(
        @NotBlank String name,
        @NotNull TransactionType type
) {
}
