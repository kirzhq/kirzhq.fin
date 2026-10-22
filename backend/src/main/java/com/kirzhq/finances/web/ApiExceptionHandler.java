package com.kirzhq.finances.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * Turns service errors into {"message": "..."} so the frontend can show the reason
 * instead of a bare status code.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    private static final Map<String, String> FIELD_NAMES = Map.of(
            "amount", "Сумма",
            "name", "Название",
            "category", "Категория",
            "initialAmount", "Сумма долга",
            "targetAmount", "Сумма цели",
            "monthlyLimit", "Лимит",
            "transactionDate", "Дата",
            "paymentDate", "Дата",
            "entryDate", "Дата",
            "createdDate", "Дата");

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException exception) {
        return body(HttpStatus.BAD_REQUEST, exception.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, String>> invalid(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> FIELD_NAMES.getOrDefault(error.getField(), error.getField()) + ": " + error.getDefaultMessage())
                .distinct()
                .collect(Collectors.joining("; "));
        return body(HttpStatus.BAD_REQUEST, message.isBlank() ? "Проверьте заполнение формы" : message);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<Map<String, String>> unreadable(Exception exception) {
        return body(HttpStatus.BAD_REQUEST, "Не удалось прочитать данные запроса. Проверьте числа и даты.");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<Map<String, String>> conflict(DataIntegrityViolationException exception) {
        log.warn("Data integrity violation", exception);
        return body(HttpStatus.CONFLICT, "Изменение противоречит уже сохранённым данным");
    }

    private ResponseEntity<Map<String, String>> body(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("message", message == null ? "Ошибка запроса" : message));
    }
}
