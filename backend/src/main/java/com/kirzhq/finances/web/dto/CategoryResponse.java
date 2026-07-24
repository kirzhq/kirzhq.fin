package com.kirzhq.finances.web.dto;

import com.kirzhq.finances.domain.TransactionType;

public record CategoryResponse(Long id, String name, TransactionType type) {
}
