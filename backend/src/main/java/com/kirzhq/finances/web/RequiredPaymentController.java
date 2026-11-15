package com.kirzhq.finances.web;

import com.kirzhq.finances.service.RequiredPaymentService;
import com.kirzhq.finances.web.dto.RequiredPaymentPayRequest;
import com.kirzhq.finances.web.dto.RequiredPaymentRequest;
import com.kirzhq.finances.web.dto.RequiredPaymentResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/required-payments")
public class RequiredPaymentController {

    private final RequiredPaymentService service;

    public RequiredPaymentController(RequiredPaymentService service) {
        this.service = service;
    }

    @GetMapping
    public List<RequiredPaymentResponse> forMonth(@RequestParam @Min(2000) @Max(2100) int year,
            @RequestParam @Min(1) @Max(12) int month) {
        return service.forMonth(year, month);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RequiredPaymentResponse create(@Valid @RequestBody RequiredPaymentRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public RequiredPaymentResponse update(@PathVariable Long id, @Valid @RequestBody RequiredPaymentRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    @PostMapping("/{id}/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public RequiredPaymentResponse pay(@PathVariable Long id, @Valid @RequestBody RequiredPaymentPayRequest request) {
        return service.pay(id, request);
    }
}
