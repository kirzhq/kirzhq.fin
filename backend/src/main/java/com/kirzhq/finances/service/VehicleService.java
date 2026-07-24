package com.kirzhq.finances.service;

import com.kirzhq.finances.domain.Vehicle;
import com.kirzhq.finances.domain.Transaction;
import com.kirzhq.finances.repository.VehicleRepository;
import com.kirzhq.finances.repository.TransactionRepository;
import com.kirzhq.finances.web.dto.VehicleResponse;
import com.kirzhq.finances.web.dto.VehicleSummaryResponse;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class VehicleService {
    private static final Pattern FUEL_PATTERN = Pattern.compile("бенз|азс|топлив", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private final VehicleRepository repository;
    private final TransactionRepository transactionRepository;

    public VehicleService(VehicleRepository repository, TransactionRepository transactionRepository) {
        this.repository = repository;
        this.transactionRepository = transactionRepository;
    }

    public List<VehicleResponse> findAll() {
        return repository.findAllByOrderByNameAsc().stream().map(this::toResponse).toList();
    }

    public Vehicle get(Long id) {
        return id == null ? null : repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Автомобиль не найден"));
    }

    public Long defaultVehicleId() {
        return repository.findAllByOrderByNameAsc().stream().findFirst().map(Vehicle::getId).orElse(null);
    }

    public VehicleSummaryResponse summary(Long id, int year) {
        List<Transaction> transactions = transactions(id, year);
        BigDecimal total = sum(transactions);
        BigDecimal fuel = sum(transactions.stream().filter(this::isFuel).toList());
        int activeMonths = (int) transactions.stream()
                .map(transaction -> YearMonth.from(transaction.getTransactionDate()))
                .distinct()
                .count();
        BigDecimal average = activeMonths == 0
                ? BigDecimal.ZERO
                : fuel.divide(BigDecimal.valueOf(activeMonths), 2, RoundingMode.HALF_UP);
        return new VehicleSummaryResponse(total, fuel, total.subtract(fuel), average, activeMonths, transactions.size());
    }

    public byte[] export(Long id, int year) {
        Vehicle vehicle = get(id);
        List<Transaction> transactions = transactions(id, year);
        VehicleSummaryResponse summary = summary(id, year);

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Расходы " + year);
            CellStyle titleStyle = titleStyle(workbook);
            CellStyle headerStyle = headerStyle(workbook);
            CellStyle moneyStyle = workbook.createCellStyle();
            moneyStyle.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00 [$₽-ru-RU]"));

            Row title = sheet.createRow(0);
            title.createCell(0).setCellValue("Отчёт по автомобилю " + vehicle.getName() + " за " + year + " год");
            title.getCell(0).setCellStyle(titleStyle);

            writeSummary(sheet, 2, "Всего расходов", summary.total(), moneyStyle);
            writeSummary(sheet, 3, "Топливо", summary.fuel(), moneyStyle);
            writeSummary(sheet, 4, "Среднемесячный расход на бензин", summary.averageMonthlyFuel(), moneyStyle);
            writeSummary(sheet, 5, "Другие расходы", summary.other(), moneyStyle);
            writeSummary(sheet, 6, "Месяцев с расходами", BigDecimal.valueOf(summary.activeMonths()), null);
            writeSummary(sheet, 7, "Количество операций", BigDecimal.valueOf(summary.operationCount()), null);

            Row header = sheet.createRow(9);
            String[] headings = {"Дата", "Категория", "Тип расхода", "Сумма", "Комментарий", "Автомобиль"};
            for (int index = 0; index < headings.length; index++) {
                header.createCell(index).setCellValue(headings[index]);
                header.getCell(index).setCellStyle(headerStyle);
            }

            int rowIndex = 10;
            for (Transaction transaction : transactions) {
                Row row = sheet.createRow(rowIndex++);
                row.createCell(0).setCellValue(transaction.getTransactionDate().toString());
                row.createCell(1).setCellValue(transaction.getCategory());
                row.createCell(2).setCellValue(isFuel(transaction) ? "Топливо" : "Прочее");
                row.createCell(3).setCellValue(transaction.getAmount().doubleValue());
                row.getCell(3).setCellStyle(moneyStyle);
                row.createCell(4).setCellValue(transaction.getDescription());
                row.createCell(5).setCellValue(vehicle.getName());
            }

            int[] widths = {14, 18, 16, 16, 52, 20};
            for (int index = 0; index < widths.length; index++) {
                sheet.setColumnWidth(index, widths[index] * 256);
            }
            sheet.createFreezePane(0, 10);
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Не удалось сформировать Excel-отчёт", exception);
        }
    }

    private List<Transaction> transactions(Long id, int year) {
        get(id);
        LocalDate from = LocalDate.of(year, 1, 1);
        return transactionRepository
                .findAllByVehicleIdAndTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateAscIdAsc(
                        id, from, from.plusYears(1));
    }

    private boolean isFuel(Transaction transaction) {
        return FUEL_PATTERN.matcher(transaction.getDescription().toLowerCase(Locale.ROOT)).find();
    }

    private BigDecimal sum(List<Transaction> transactions) {
        return transactions.stream().map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private void writeSummary(Sheet sheet, int rowIndex, String label, BigDecimal value, CellStyle valueStyle) {
        Row row = sheet.createRow(rowIndex);
        row.createCell(0).setCellValue(label);
        row.createCell(1).setCellValue(value.doubleValue());
        if (valueStyle != null) {
            row.getCell(1).setCellStyle(valueStyle);
        }
    }

    private CellStyle titleStyle(XSSFWorkbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 15);
        style.setFont(font);
        return style;
    }

    private CellStyle headerStyle(XSSFWorkbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.INDIGO.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        return style;
    }

    private VehicleResponse toResponse(Vehicle vehicle) {
        return new VehicleResponse(vehicle.getId(), vehicle.getName());
    }
}
