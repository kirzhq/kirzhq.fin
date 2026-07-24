package com.kirzhq.finances.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kirzhq.finances.domain.TransactionType;
import com.kirzhq.finances.web.dto.TransactionRequest;
import com.kirzhq.finances.web.dto.TransactionResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
public class TelegramBotService {
    private final TransactionService transactions;
    private final VehicleService vehicles;
    private final ObjectMapper json;
    private final RestClient http = RestClient.create();
    private final String token;
    private final String allowedChatId;
    private long offset;

    public TelegramBotService(TransactionService transactions, VehicleService vehicles, ObjectMapper json,
                              @Value("${app.telegram.token:}") String token,
                              @Value("${app.telegram.allowed-chat-id:}") String allowedChatId) {
        this.transactions = transactions;
        this.vehicles = vehicles;
        this.json = json;
        this.token = token.trim();
        this.allowedChatId = allowedChatId.trim();
    }

    @Scheduled(fixedDelay = 1500)
    public void poll() {
        if (token.isBlank()) return;
        try {
            String body = http.get().uri(api("getUpdates") + "?timeout=1&offset=" + offset)
                    .retrieve().body(String.class);
            for (JsonNode update : json.readTree(body).path("result")) {
                offset = Math.max(offset, update.path("update_id").asLong() + 1);
                JsonNode message = update.path("message");
                String chatId = message.path("chat").path("id").asText();
                String text = message.path("text").asText("").trim();
                if (!allowedChatId.equals(chatId)) {
                    if (text.equals("/id")) send(chatId, "ID этого чата: " + chatId);
                    else if (!chatId.isBlank()) send(chatId, "Доступ запрещён. Узнать ID чата: /id");
                    continue;
                }
                if (!text.isBlank()) handle(chatId, text);
            }
        } catch (Exception ignored) {
            // Следующий цикл повторит запрос; временная недоступность Telegram не влияет на приложение.
        }
    }

    private void handle(String chatId, String text) {
        try {
            if (text.equals("/start") || text.equals("/help")) {
                send(chatId, help());
            } else if (text.equals("/list")) {
                List<TransactionResponse> items = transactions.findAll(LocalDate.now().getYear(), null);
                StringBuilder result = new StringBuilder("Последние операции:\n");
                items.stream().limit(10).forEach(item -> result.append('#').append(item.id()).append(" · ")
                        .append(item.transactionDate()).append(" · ").append(item.category()).append(" · ")
                        .append(item.amount()).append(" ₽\n"));
                send(chatId, result.toString());
            } else if (text.startsWith("/add ")) {
                TransactionRequest request = parse(text.substring(5));
                TransactionResponse created = transactions.create(request);
                send(chatId, "Добавлено: #" + created.id() + " · " + created.category() + " · " + created.amount() + " ₽");
            } else if (text.startsWith("/edit ")) {
                String[] first = text.substring(6).split("\\|", 2);
                if (first.length != 2) throw new IllegalArgumentException("После ID нужен символ |");
                long id = Long.parseLong(first[0].trim());
                TransactionResponse updated = transactions.update(id, parse(first[1]));
                send(chatId, "Изменено: #" + updated.id() + " · " + updated.category() + " · " + updated.amount() + " ₽");
            } else {
                send(chatId, help());
            }
        } catch (Exception error) {
            send(chatId, "Не удалось выполнить команду: " + error.getMessage() + "\n\n" + help());
        }
    }

    private TransactionRequest parse(String value) {
        String[] parts = value.split("\\|", -1);
        if (parts.length < 4) throw new IllegalArgumentException("Недостаточно полей");
        TransactionType type = switch (parts[0].trim().toLowerCase()) {
            case "доход" -> TransactionType.INCOME;
            case "расход" -> TransactionType.EXPENSE;
            default -> throw new IllegalArgumentException("Тип должен быть «Доход» или «Расход»");
        };
        String category = parts[1].trim();
        Long vehicleId = "Машина".equalsIgnoreCase(category) ? vehicles.defaultVehicleId() : null;
        return new TransactionRequest(type, category, new BigDecimal(parts[2].trim().replace(',', '.')),
                LocalDate.parse(parts[3].trim()), parts.length > 4 ? parts[4].trim() : "", vehicleId);
    }

    private void send(String chatId, String text) {
        try {
            http.post().uri(api("sendMessage")).body(new Message(chatId, text)).retrieve().toBodilessEntity();
        } catch (Exception ignored) {
        }
    }

    private String api(String method) {
        return "https://api.telegram.org/bot" + token + "/" + method;
    }

    private String help() {
        return """
                Команды:
                /list
                /add Расход | Еда домой | 1250 | 2026-07-24 | Продукты
                /edit 127 | Расход | Подписки | 399 | 2026-07-22 | Альфа-смарт
                """;
    }

    private record Message(String chat_id, String text) {
    }
}
