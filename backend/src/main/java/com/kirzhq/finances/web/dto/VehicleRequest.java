package com.kirzhq.finances.web.dto;

import jakarta.validation.constraints.NotBlank;

public record VehicleRequest(@NotBlank String name) {
}
