package com.kirzhq.finances.service;

import com.kirzhq.finances.domain.Vehicle;
import com.kirzhq.finances.domain.Transaction;
import com.kirzhq.finances.domain.VehicleExpenseType;
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
        get(id);
        List<Transaction> transactions = transactions(id, year);
        List<Transaction> allTransactions = transactionRepository.findAllByVehicleIdOrderByTransactionDateAscIdAsc(id);
        return buildSummary(transactions, allTransactions);
    }

    private VehicleSummaryResponse buildSummary(List<Transaction> transactions, List<Transaction> allTransactions) {
        BigDecimal total = sum(transactions);
        BigDecimal fuel = sum(transactions.stream().filter(this::isFuel).toList());
        int activeMonths = (int) transactions.stream()
                .map(transaction -> YearMonth.from(transaction.getTransactionDate()))
                .distinct()
                .count();
        BigDecimal average = activeMonths == 0
                ? BigDecimal.ZERO
                : fuel.divide(BigDecimal.valueOf(activeMonths), 2, RoundingMode.HALF_UP);
        MileageSummary mileage = mileageSummary(allTransactions);
        return new VehicleSummaryResponse(
                total, fuel, total.subtract(fuel), average, activeMonths, transactions.size(),
                mileage.firstOdometerKm(), mileage.latestOdometerKm(), mileage.mileageKm(),
                mileage.fuelConsumptionPer100Km(), mileage.fuelCostPer100Km(),
                mileage.latestFuelConsumptionPer100Km(), mileage.latestFuelCostPer100Km(), mileage.complete());
    }

    public byte[] export(Long id, int year) {
        Vehicle vehicle = get(id);
        List<Transaction> transactions = transactions(id, year);
        List<Transaction> allTransactions = transactionRepository.findAllByVehicleIdOrderByTransactionDateAscIdAsc(id);
        VehicleSummaryResponse summary = buildSummary(transactions, allTransactions);

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
            writeSummary(sheet, 8, "Пробег по журналу, км", BigDecimal.valueOf(summary.mileageKm() == null ? 0 : summary.mileageKm()), null);
            if (summary.mileageComplete() && summary.fuelCostPer100Km() != null) {
                writeSummary(sheet, 9, "Стоимость бензина на 100 км", summary.fuelCostPer100Km(), moneyStyle);
                writeSummary(sheet, 10, "Расход топлива на 100 км, л", summary.fuelConsumptionPer100Km(), null);
            }
            if (summary.latestFuelConsumptionPer100Km() != null) {
                writeSummary(sheet, 11, "Расход на последнем интервале, л/100 км", summary.latestFuelConsumptionPer100Km(), null);
                writeSummary(sheet, 12, "Стоимость последнего интервала на 100 км", summary.latestFuelCostPer100Km(), moneyStyle);
            }

            Row header = sheet.createRow(14);
            String[] headings = {"Дата", "Категория", "Подкатегория", "Сумма", "Пробег, км", "Топливо, л", "Комментарий", "Автомобиль"};
            for (int index = 0; index < headings.length; index++) {
                header.createCell(index).setCellValue(headings[index]);
                header.getCell(index).setCellStyle(headerStyle);
            }

            int rowIndex = 15;
            for (Transaction transaction : transactions) {
                Row row = sheet.createRow(rowIndex++);
                row.createCell(0).setCellValue(transaction.getTransactionDate().toString());
                row.createCell(1).setCellValue(transaction.getCategory());
                row.createCell(2).setCellValue(expenseTypeLabel(transaction));
                row.createCell(3).setCellValue(transaction.getAmount().doubleValue());
                row.getCell(3).setCellStyle(moneyStyle);
                if (transaction.getOdometerKm() != null) row.createCell(4).setCellValue(transaction.getOdometerKm());
                if (transaction.getFuelLiters() != null) row.createCell(5).setCellValue(transaction.getFuelLiters().doubleValue());
                row.createCell(6).setCellValue(transaction.getDescription());
                row.createCell(7).setCellValue(vehicle.getName());
            }

            int[] widths = {14, 18, 16, 16, 16, 14, 52, 20};
            for (int index = 0; index < widths.length; index++) {
                sheet.setColumnWidth(index, widths[index] * 256);
            }
            sheet.createFreezePane(0, 15);
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Не удалось сформировать Excel-отчёт", exception);
        }
    }

    private List<Transaction> transactions(Long id, int year) {
        LocalDate from = LocalDate.of(year, 1, 1);
        return transactionRepository
                .findAllByVehicleIdAndTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateAscIdAsc(
                        id, from, from.plusYears(1));
    }

    private boolean isFuel(Transaction transaction) {
        return transaction.getVehicleExpenseType() == VehicleExpenseType.FUEL
                || (transaction.getVehicleExpenseType() == null && FUEL_PATTERN.matcher(transaction.getDescription()).find());
    }

    private String expenseTypeLabel(Transaction transaction) {
        if (isFuel(transaction)) return "Бензин";
        if (transaction.getVehicleExpenseType() == VehicleExpenseType.MAINTENANCE) return "Тех. обслуживание";
        return "Прочее";
    }

    private MileageSummary mileageSummary(List<Transaction> allTransactions) {
        List<Transaction> fuelTransactions = allTransactions.stream().filter(this::isFuel).toList();
        int firstIndex = -1;
        for (int index = 0; index < fuelTransactions.size(); index++) {
            if (fuelTransactions.get(index).getOdometerKm() != null) {
                firstIndex = index;
                break;
            }
        }
        if (firstIndex < 0) return new MileageSummary(null, null, null, null, null, null, null, false);

        long first = fuelTransactions.get(firstIndex).getOdometerKm();
        long latest = first;
        long previous = first;
        boolean complete = true;
        BigDecimal trackedFuelCost = BigDecimal.ZERO;
        BigDecimal trackedFuelLiters = BigDecimal.ZERO;
        for (int index = firstIndex + 1; index < fuelTransactions.size(); index++) {
            Transaction transaction = fuelTransactions.get(index);
            trackedFuelCost = trackedFuelCost.add(transaction.getAmount());
            if (transaction.getFuelLiters() == null) {
                complete = false;
            } else {
                trackedFuelLiters = trackedFuelLiters.add(transaction.getFuelLiters());
            }
            if (transaction.getOdometerKm() == null) {
                complete = false;
                continue;
            }
            long current = transaction.getOdometerKm();
            if (current < previous) complete = false;
            previous = current;
            latest = current;
        }
        long mileage = Math.max(0, latest - first);
        complete = complete && mileage > 0 && trackedFuelLiters.signum() > 0;
        BigDecimal consumptionPer100Km = complete
                ? trackedFuelLiters.multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(mileage), 2, RoundingMode.HALF_UP)
                : null;
        BigDecimal costPer100Km = complete
                ? trackedFuelCost.multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(mileage), 2, RoundingMode.HALF_UP)
                : null;
        BigDecimal latestConsumptionPer100Km = null;
        BigDecimal latestCostPer100Km = null;
        if (fuelTransactions.size() >= 2) {
            Transaction previousTransaction = fuelTransactions.get(fuelTransactions.size() - 2);
            Transaction latestTransaction = fuelTransactions.get(fuelTransactions.size() - 1);
            if (previousTransaction.getOdometerKm() != null && latestTransaction.getOdometerKm() != null
                    && latestTransaction.getFuelLiters() != null
                    && latestTransaction.getOdometerKm() > previousTransaction.getOdometerKm()) {
                long latestMileage = latestTransaction.getOdometerKm() - previousTransaction.getOdometerKm();
                latestConsumptionPer100Km = latestTransaction.getFuelLiters().multiply(BigDecimal.valueOf(100))
                        .divide(BigDecimal.valueOf(latestMileage), 2, RoundingMode.HALF_UP);
                latestCostPer100Km = latestTransaction.getAmount().multiply(BigDecimal.valueOf(100))
                        .divide(BigDecimal.valueOf(latestMileage), 2, RoundingMode.HALF_UP);
            }
        }
        return new MileageSummary(first, latest, mileage, consumptionPer100Km, costPer100Km,
                latestConsumptionPer100Km, latestCostPer100Km, complete);
    }

    private record MileageSummary(Long firstOdometerKm, Long latestOdometerKm, Long mileageKm,
            BigDecimal fuelConsumptionPer100Km, BigDecimal fuelCostPer100Km,
            BigDecimal latestFuelConsumptionPer100Km, BigDecimal latestFuelCostPer100Km, boolean complete) {}

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
