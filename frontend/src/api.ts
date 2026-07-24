import type { Category, Summary, Transaction, TransactionType, Vehicle } from './types';

const API_BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function periodQuery(year: number, month: number | null) {
  const params = new URLSearchParams({ year: String(year) });
  if (month) params.set('month', String(month));
  return params.toString();
}

export function getTransactions(year: number, month: number | null) {
  return request<Transaction[]>(`/transactions?${periodQuery(year, month)}`);
}

export function getSummary(year: number, month: number | null) {
  return request<Summary>(`/summary?${periodQuery(year, month)}`);
}

export function createTransaction(payload: Omit<Transaction, 'id' | 'vehicleName'>) {
  return request<Transaction>('/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateTransaction(id: number, payload: Omit<Transaction, 'id' | 'vehicleName'>) {
  return request<Transaction>(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteTransaction(id: number) {
  const response = await fetch(`${API_BASE}/transactions/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
}

export function getCategories() {
  return request<Category[]>('/categories');
}

export function createCategory(payload: { name: string; type: TransactionType }) {
  return request<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getVehicles() {
  return request<Vehicle[]>('/vehicles');
}

export function createVehicle(name: string) {
  return request<Vehicle>('/vehicles', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}
