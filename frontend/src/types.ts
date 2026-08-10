export type TransactionType = 'INCOME' | 'EXPENSE';
export type VehicleExpenseType = 'FUEL' | 'MAINTENANCE' | 'OTHER';

export type Transaction = {
  id: number;
  type: TransactionType;
  category: string;
  amount: number;
  transactionDate: string;
  description: string;
  vehicleId: number | null;
  vehicleName: string | null;
  vehicleExpenseType: VehicleExpenseType | null;
  odometerKm: number | null;
  fuelLiters: number | null;
};

export type Category = {
  id: number;
  name: string;
  type: TransactionType;
};

export type Vehicle = {
  id: number;
  name: string;
};

export type VehicleSummary = {
  total: number;
  fuel: number;
  other: number;
  averageMonthlyFuel: number;
  activeMonths: number;
  operationCount: number;
  firstOdometerKm: number | null;
  latestOdometerKm: number | null;
  mileageKm: number | null;
  fuelConsumptionPer100Km: number | null;
  fuelCostPer100Km: number | null;
  latestFuelConsumptionPer100Km: number | null;
  latestFuelCostPer100Km: number | null;
  mileageComplete: boolean;
};

export type Summary = {
  income: number;
  expense: number;
  balance: number;
  averageDailyExpense: number;
  foodExpense: number;
  averageDailyFoodExpense: number;
  calculationDays: number;
  monthlyPoints: Array<{
    month: string;
    income: number;
    expense: number;
  }>;
  categoryPoints: Array<{
    category: string;
    amount: number;
  }>;
};

export type Debt = {
  id: number;
  name: string;
  initialAmount: number;
  paidAmount: number;
  remainingAmount: number;
  progressPercent: number;
  createdDate: string;
  note: string;
  payments: Array<{
    id: number;
    transactionId: number;
    amount: number;
    paymentDate: string;
    comment: string;
  }>;
};

export type SavingsGoal = {
  id: number;
  name: string;
  targetAmount: number;
  savedAmount: number;
  remainingAmount: number;
  progressPercent: number;
  targetDate: string | null;
  createdDate: string;
  note: string;
  color: string;
  averageMonthly: number;
  projectedDate: string | null;
  recommendedMonthly: number;
  entries: Array<{ id: number; amount: number; entryDate: string; comment: string }>;
};
