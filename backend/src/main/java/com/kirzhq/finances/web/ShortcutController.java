package com.kirzhq.finances.web;

import com.kirzhq.finances.domain.TransactionType;
import com.kirzhq.finances.service.CategoryService;
import com.kirzhq.finances.service.TransactionService;
import com.kirzhq.finances.service.VehicleService;
import com.kirzhq.finances.web.dto.ShortcutTransactionRequest;
import com.kirzhq.finances.web.dto.TransactionRequest;
import com.kirzhq.finances.web.dto.TransactionResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@RestController
@RequestMapping("/api/shortcut")
public class ShortcutController {

    private static final ZoneId MOSCOW = ZoneId.of("Europe/Moscow");

    private final TransactionService transactionService;
    private final CategoryService categoryService;
    private final VehicleService vehicleService;
    private final ShortcutTokenAuthenticator tokenAuthenticator;

    public ShortcutController(
            TransactionService transactionService,
            CategoryService categoryService,
            VehicleService vehicleService,
            ShortcutTokenAuthenticator tokenAuthenticator
    ) {
        this.transactionService = transactionService;
        this.categoryService = categoryService;
        this.vehicleService = vehicleService;
        this.tokenAuthenticator = tokenAuthenticator;
    }

    @GetMapping("/categories")
    public List<String> categories(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(defaultValue = "EXPENSE") TransactionType type
    ) {
        tokenAuthenticator.authenticate(authorization);
        return categoryService.findAll().stream()
                .filter(category -> category.type() == type)
                .map(category -> category.name())
                .toList();
    }

    @PostMapping("/transactions")
    @ResponseStatus(HttpStatus.CREATED)
    public TransactionResponse create(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody ShortcutTransactionRequest request
    ) {
        tokenAuthenticator.authenticate(authorization);
        TransactionType type = request.type() == null ? TransactionType.EXPENSE : request.type();
        boolean vehicleExpense = "Машина".equalsIgnoreCase(request.category());
        TransactionRequest transaction = new TransactionRequest(
                type,
                request.category(),
                request.amount(),
                request.transactionDate() == null ? LocalDate.now(MOSCOW) : request.transactionDate(),
                request.description(),
                vehicleExpense ? vehicleService.defaultVehicleId() : null,
                request.vehicleExpenseType(),
                request.odometerKm(),
                request.fuelLiters()
        );
        return transactionService.create(transaction);
    }

}
