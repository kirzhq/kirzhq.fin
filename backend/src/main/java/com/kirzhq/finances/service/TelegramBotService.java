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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TelegramBotService {
    private final TransactionService transactions;
    private final VehicleService vehicles;
    private final CategoryService categories;
    private final ObjectMapper json;
    private final RestClient http = RestClient.create();
    private final String token;
    private final String allowedChatId;
    private long offset;
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();

    public TelegramBotService(TransactionService transactions, VehicleService vehicles, CategoryService categories, ObjectMapper json,
                              @Value("${app.telegram.token:}") String token,
                              @Value("${app.telegram.allowed-chat-id:}") String allowedChatId) {
        this.transactions = transactions;
        this.vehicles = vehicles;
        this.categories = categories;
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
            if (text.equals("❌ Отмена")) {
                sessions.remove(chatId);
                sendMenu(chatId, "Действие отменено.");
            } else if (text.equals("/start") || text.equals("/help") || text.equals("ℹ️ Помощь")) {
                sendMenu(chatId, "Выберите действие на клавиатуре.");
            } else if (text.equals("/list") || text.equals("📋 Последние операции")) {
                List<TransactionResponse> items = transactions.findAll(LocalDate.now().getYear(), null);
                StringBuilder result = new StringBuilder("Последние операции:\n");
                items.stream().limit(10).forEach(item -> result.append('#').append(item.id()).append(" · ")
                        .append(item.transactionDate()).append(" · ").append(item.category()).append(" · ")
                        .append(item.amount()).append(" ₽\n"));
                sendMenu(chatId, result.toString());
            } else if (text.equals("➕ Добавить операцию")) {
                sessions.put(chatId, new Session(false));
                askType(chatId);
            } else if (text.equals("✏️ Редактировать")) {
                Session session = new Session(true);
                session.step = Step.ID;
                sessions.put(chatId, session);
                send(chatId, "Введите ID операции. Его можно посмотреть кнопкой «Последние операции».", cancelKeyboard());
            } else if (sessions.containsKey(chatId)) {
                advance(chatId, text);
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
                sendMenu(chatId, "Используйте кнопки внизу.");
            }
        } catch (Exception error) {
            send(chatId, "Не удалось выполнить команду: " + error.getMessage() + "\n\n" + help());
        }
    }

    private void advance(String chatId, String text) {
        Session session = sessions.get(chatId);
        switch (session.step) {
            case ID -> {
                session.id = Long.parseLong(text.replace("#", "").trim());
                askType(chatId);
            }
            case TYPE -> {
                session.type = switch (text) {
                    case "Расход" -> TransactionType.EXPENSE;
                    case "Доход" -> TransactionType.INCOME;
                    default -> throw new IllegalArgumentException("Выберите тип кнопкой");
                };
                session.step = Step.CATEGORY;
                List<List<Button>> rows = new ArrayList<>();
                categories.findAll().stream().filter(item -> item.type() == session.type)
                        .forEach(item -> rows.add(List.of(new Button(item.name()))));
                rows.add(List.of(new Button("❌ Отмена")));
                send(chatId, "Выберите категорию:", new Keyboard(rows, true, true));
            }
            case CATEGORY -> {
                session.category = text;
                session.step = Step.AMOUNT;
                send(chatId, "Введите сумму, например 1250:", cancelKeyboard());
            }
            case AMOUNT -> {
                session.amount = new BigDecimal(text.replace(',', '.').replace(" ", ""));
                session.step = Step.DATE;
                send(chatId, "Укажите дату:", new Keyboard(List.of(
                        List.of(new Button("Сегодня")), List.of(new Button("❌ Отмена"))), true, true));
            }
            case DATE -> {
                session.date = text.equals("Сегодня") ? LocalDate.now() : LocalDate.parse(text);
                session.step = Step.COMMENT;
                send(chatId, "Введите комментарий или нажмите «Без комментария»:",
                        new Keyboard(List.of(List.of(new Button("Без комментария")), List.of(new Button("❌ Отмена"))), true, true));
            }
            case COMMENT -> {
                String description = text.equals("Без комментария") ? "" : text;
                Long vehicleId = "Машина".equalsIgnoreCase(session.category) ? vehicles.defaultVehicleId() : null;
                TransactionRequest request = new TransactionRequest(session.type, session.category, session.amount,
                        session.date, description, vehicleId);
                TransactionResponse result = session.edit ? transactions.update(session.id, request) : transactions.create(request);
                sessions.remove(chatId);
                sendMenu(chatId, (session.edit ? "Изменено: #" : "Добавлено: #") + result.id()
                        + " · " + result.category() + " · " + result.amount() + " ₽");
            }
        }
    }

    private void askType(String chatId) {
        Session session = sessions.get(chatId);
        session.step = Step.TYPE;
        send(chatId, "Выберите тип операции:",
                new Keyboard(List.of(List.of(new Button("Расход"), new Button("Доход")),
                        List.of(new Button("❌ Отмена"))), true, true));
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
        send(chatId, text, menuKeyboard());
    }

    private void sendMenu(String chatId, String text) {
        send(chatId, text, menuKeyboard());
    }

    private void send(String chatId, String text, Keyboard keyboard) {
        try {
            http.post().uri(api("sendMessage")).body(new Message(chatId, text, keyboard)).retrieve().toBodilessEntity();
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

    private Keyboard menuKeyboard() {
        return new Keyboard(List.of(
                List.of(new Button("➕ Добавить операцию"), new Button("✏️ Редактировать")),
                List.of(new Button("📋 Последние операции"), new Button("ℹ️ Помощь"))), true, false);
    }

    private Keyboard cancelKeyboard() {
        return new Keyboard(List.of(List.of(new Button("❌ Отмена"))), true, true);
    }

    private enum Step { ID, TYPE, CATEGORY, AMOUNT, DATE, COMMENT }

    private static final class Session {
        private final boolean edit;
        private Step step;
        private Long id;
        private TransactionType type;
        private String category;
        private BigDecimal amount;
        private LocalDate date;
        private Session(boolean edit) { this.edit = edit; }
    }

    private record Button(String text) {}
    private record Keyboard(List<List<Button>> keyboard, boolean resize_keyboard, boolean one_time_keyboard) {}
    private record Message(String chat_id, String text, Keyboard reply_markup) {
    }
}
