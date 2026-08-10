package com.kirzhq.finances.service;

import com.kirzhq.finances.domain.SavingsEntry;
import com.kirzhq.finances.domain.SavingsGoal;
import com.kirzhq.finances.repository.SavingsEntryRepository;
import com.kirzhq.finances.repository.SavingsGoalRepository;
import com.kirzhq.finances.web.dto.SavingsEntryRequest;
import com.kirzhq.finances.web.dto.SavingsGoalRequest;
import com.kirzhq.finances.web.dto.SavingsGoalResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class SavingsService {
    private final SavingsGoalRepository goals;
    private final SavingsEntryRepository entries;

    public SavingsService(SavingsGoalRepository goals, SavingsEntryRepository entries) {
        this.goals = goals;
        this.entries = entries;
    }

    @Transactional(readOnly = true)
    public List<SavingsGoalResponse> findAll() {
        List<SavingsGoal> goalList = goals.findAllByOrderByCreatedDateDescIdDesc();
        if (goalList.isEmpty()) return List.of();
        Map<Long, List<SavingsEntry>> byGoal = entries.findAllByGoalIdIn(goalList.stream().map(SavingsGoal::getId).toList())
                .stream().collect(Collectors.groupingBy(entry -> entry.getGoal().getId()));
        return goalList.stream().map(goal -> response(goal, byGoal.getOrDefault(goal.getId(), List.of()))).toList();
    }

    @Transactional
    public SavingsGoalResponse create(SavingsGoalRequest request) {
        SavingsGoal goal = new SavingsGoal();
        apply(goal, request);
        return response(goals.save(goal), List.of());
    }

    @Transactional
    public SavingsGoalResponse update(Long id, SavingsGoalRequest request) {
        SavingsGoal goal = get(id);
        apply(goal, request);
        return response(goals.save(goal), entries.findAllByGoalId(id));
    }

    @Transactional
    public void delete(Long id) { goals.delete(get(id)); }

    @Transactional
    public SavingsGoalResponse addEntry(Long id, SavingsEntryRequest request) {
        SavingsGoal goal = get(id);
        BigDecimal signedAmount = request.withdrawal() ? request.amount().negate() : request.amount();
        BigDecimal saved = total(entries.findAllByGoalId(id));
        if (request.withdrawal() && request.amount().compareTo(saved.max(BigDecimal.ZERO)) > 0) {
            throw new IllegalArgumentException("Нельзя снять больше, чем накоплено");
        }
        SavingsEntry entry = new SavingsEntry();
        entry.setGoal(goal);
        entry.setAmount(signedAmount);
        entry.setEntryDate(request.entryDate());
        entry.setComment(request.comment() == null ? "" : request.comment().trim());
        entries.save(entry);
        return response(goal, entries.findAllByGoalId(id));
    }

    @Transactional
    public void deleteEntry(Long goalId, Long entryId) {
        SavingsEntry entry = entries.findById(entryId)
                .filter(item -> item.getGoal().getId().equals(goalId))
                .orElseThrow(() -> new IllegalArgumentException("Запись накопления не найдена"));
        entries.delete(entry);
    }

    private SavingsGoal get(Long id) {
        return goals.findById(id).orElseThrow(() -> new IllegalArgumentException("Цель не найдена"));
    }

    private void apply(SavingsGoal goal, SavingsGoalRequest request) {
        goal.setName(request.name().trim());
        goal.setTargetAmount(request.targetAmount());
        goal.setTargetDate(request.targetDate());
        goal.setCreatedDate(request.createdDate());
        goal.setNote(request.note() == null ? "" : request.note().trim());
        goal.setColor(request.color() == null ? "#6c5ce7" : request.color().toLowerCase());
    }

    private SavingsGoalResponse response(SavingsGoal goal, List<SavingsEntry> sourceEntries) {
        List<SavingsEntry> ordered = sourceEntries.stream()
                .sorted(Comparator.comparing(SavingsEntry::getEntryDate).thenComparing(SavingsEntry::getId).reversed())
                .toList();
        BigDecimal saved = total(ordered).max(BigDecimal.ZERO);
        BigDecimal remaining = goal.getTargetAmount().subtract(saved).max(BigDecimal.ZERO);
        int progress = saved.min(goal.getTargetAmount()).multiply(BigDecimal.valueOf(100))
                .divide(goal.getTargetAmount(), 0, RoundingMode.HALF_UP).intValue();
        BigDecimal average = averageMonthly(ordered);
        LocalDate projected = average.signum() > 0 && remaining.signum() > 0
                ? LocalDate.now().plusMonths(remaining.divide(average, 0, RoundingMode.CEILING).longValue()) : null;
        BigDecimal recommended = recommendedMonthly(goal.getTargetDate(), remaining);
        return new SavingsGoalResponse(goal.getId(), goal.getName(), goal.getTargetAmount(), saved, remaining,
                progress, goal.getTargetDate(), goal.getCreatedDate(), goal.getNote(), goal.getColor(), average,
                projected, recommended, ordered.stream().map(entry -> new SavingsGoalResponse.Entry(
                        entry.getId(), entry.getAmount(), entry.getEntryDate(), entry.getComment())).toList());
    }

    private BigDecimal total(List<SavingsEntry> values) {
        return values.stream().map(SavingsEntry::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal averageMonthly(List<SavingsEntry> values) {
        if (values.isEmpty()) return BigDecimal.ZERO;
        YearMonth first = values.stream().map(SavingsEntry::getEntryDate).min(LocalDate::compareTo).map(YearMonth::from).orElse(YearMonth.now());
        long months = Math.max(1, ChronoUnit.MONTHS.between(first, YearMonth.now()) + 1);
        return total(values).max(BigDecimal.ZERO).divide(BigDecimal.valueOf(months), 2, RoundingMode.HALF_UP);
    }

    private BigDecimal recommendedMonthly(LocalDate targetDate, BigDecimal remaining) {
        if (targetDate == null || remaining.signum() == 0) return BigDecimal.ZERO;
        long months = Math.max(1, ChronoUnit.MONTHS.between(YearMonth.now(), YearMonth.from(targetDate)) + 1);
        return remaining.divide(BigDecimal.valueOf(months), 2, RoundingMode.CEILING);
    }
}
