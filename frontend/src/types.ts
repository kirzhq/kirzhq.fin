export type TransactionType = 'INCOME' | 'EXPENSE';

export type Transaction = {
  id: number;
  type: TransactionType;
  category: string;
  amount: number;
  transactionDate: string;
  description: string;
  vehicleId: number | null;
  vehicleName: string | null;
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

export type Summary = {
  income: number;
  expense: number;
  balance: number;
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
