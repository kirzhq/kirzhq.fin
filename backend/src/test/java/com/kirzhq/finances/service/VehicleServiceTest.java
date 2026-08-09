package com.kirzhq.finances.service;

import com.kirzhq.finances.domain.Transaction;
import com.kirzhq.finances.domain.Vehicle;
import com.kirzhq.finances.domain.VehicleExpenseType;
import com.kirzhq.finances.repository.TransactionRepository;
import com.kirzhq.finances.repository.VehicleRepository;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
class VehicleServiceTest {

    @Test
    void excelExportContainsEveryVehicleExpenseType() throws Exception {
        Vehicle vehicle = new Vehicle();
        vehicle.setName("Lada Vesta");

        List<Transaction> transactions = List.of(
                transaction(VehicleExpenseType.FUEL, "2500", 48_000L),
                transaction(VehicleExpenseType.MAINTENANCE, "8000", null),
                transaction(VehicleExpenseType.OTHER, "500", null));
        VehicleRepository vehicleRepository = proxy(VehicleRepository.class, (method, args) ->
                method.getName().equals("findById") ? Optional.of(vehicle) : null);
        TransactionRepository transactionRepository = proxy(TransactionRepository.class, (method, args) ->
                method.getName().startsWith("findAllByVehicleId") ? transactions : null);

        byte[] exported = new VehicleService(vehicleRepository, transactionRepository).export(1L, 2026);

        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(exported))) {
            var sheet = workbook.getSheetAt(0);
            assertThat(sheet.getRow(14).getCell(2).getStringCellValue()).isEqualTo("Подкатегория");
            assertThat(List.of(
                    sheet.getRow(15).getCell(2).getStringCellValue(),
                    sheet.getRow(16).getCell(2).getStringCellValue(),
                    sheet.getRow(17).getCell(2).getStringCellValue()))
                    .containsExactly("Бензин", "Тех. обслуживание", "Прочее");
            assertThat(sheet.getRow(15).getCell(5).getNumericCellValue()).isEqualTo(40.0);
        }
    }

    @Test
    void summaryCalculatesWholeJournalAndLatestFuelInterval() {
        Vehicle vehicle = new Vehicle();
        vehicle.setName("Lada Vesta");
        Transaction first = transaction(VehicleExpenseType.FUEL, "2000", 48_000L);
        first.setFuelLiters(new BigDecimal("40"));
        Transaction latest = transaction(VehicleExpenseType.FUEL, "2500", 48_500L);
        latest.setFuelLiters(new BigDecimal("35"));
        List<Transaction> transactions = List.of(first, latest);
        VehicleRepository vehicleRepository = proxy(VehicleRepository.class, (method, args) ->
                method.getName().equals("findById") ? Optional.of(vehicle) : null);
        TransactionRepository transactionRepository = proxy(TransactionRepository.class, (method, args) ->
                method.getName().startsWith("findAllByVehicleId") ? transactions : null);

        var summary = new VehicleService(vehicleRepository, transactionRepository).summary(1L, 2026);

        assertThat(summary.mileageKm()).isEqualTo(500);
        assertThat(summary.fuelConsumptionPer100Km()).isEqualByComparingTo("7.00");
        assertThat(summary.latestFuelConsumptionPer100Km()).isEqualByComparingTo("7.00");
        assertThat(summary.fuelCostPer100Km()).isEqualByComparingTo("500.00");
        assertThat(summary.latestFuelCostPer100Km()).isEqualByComparingTo("500.00");
    }

    private Transaction transaction(VehicleExpenseType expenseType, String amount, Long odometerKm) {
        Transaction transaction = new Transaction();
        transaction.setCategory("Машина");
        transaction.setAmount(new BigDecimal(amount));
        transaction.setTransactionDate(LocalDate.of(2026, 8, 9));
        transaction.setDescription("");
        transaction.setVehicleExpenseType(expenseType);
        transaction.setOdometerKm(odometerKm);
        if (expenseType == VehicleExpenseType.FUEL) transaction.setFuelLiters(new BigDecimal("40"));
        return transaction;
    }

    @SuppressWarnings("unchecked")
    private <T> T proxy(Class<T> type, RepositoryCall call) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type},
                (proxy, method, args) -> call.invoke(method, args));
    }

    private interface RepositoryCall {
        Object invoke(java.lang.reflect.Method method, Object[] args);
    }
}
