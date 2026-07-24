import type { Category, Debt, Summary, Transaction, TransactionType, Vehicle, VehicleSummary } from './types';

const API_BASE = '/api';

function csrfToken() {
  return document.cookie.split('; ')
    .find((value) => value.startsWith('XSRF-TOKEN='))
    ?.split('=').slice(1).join('=');
}

function ensureAuthenticated(response: Response) {
  if (response.status === 401 || (response.redirected && response.url.includes('/login'))) {
    window.location.assign(`https://home.kirzhq.ru/login?continue=${encodeURIComponent(window.location.href)}`);
    throw new Error('Требуется авторизация');
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = csrfToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  ensureAuthenticated(response);
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
  const token = csrfToken();
  const response = await fetch(`${API_BASE}/transactions/${id}`, {
    method: 'DELETE',
    headers: token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {},
  });
  ensureAuthenticated(response);
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

export function getVehicleSummary(id: number, year: number) {
  return request<VehicleSummary>(`/vehicles/${id}/summary?year=${year}`);
}

export async function exportVehicle(id: number, year: number) {
  const response = await fetch(`${API_BASE}/vehicles/${id}/export?year=${year}`);
  ensureAuthenticated(response);
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `lada-vesta-${year}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function getDebts() {
  return request<Debt[]>('/debts');
}

export function createDebt(payload: { name: string; initialAmount: number; createdDate: string; note: string }) {
  return request<Debt>('/debts', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateDebt(id: number, payload: { name: string; initialAmount: number; createdDate: string; note: string }) {
  return request<Debt>(`/debts/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function deleteDebt(id: number) {
  const token = csrfToken();
  const response = await fetch(`${API_BASE}/debts/${id}`, {
    method: 'DELETE',
    headers: token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {},
  });
  ensureAuthenticated(response);
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
}

export function payDebt(id: number, payload: { amount: number; paymentDate: string; comment: string }) {
  return request<Debt>(`/debts/${id}/payments`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function exportBackup() {
  const response = await fetch(`${API_BASE}/backup/export`);
  ensureAuthenticated(response);
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `kirzhq-fin-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importBackup(file: File) {
  let backup: unknown;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    throw new Error('Не удалось прочитать файл резервной копии');
  }
  return request<{ imported: boolean }>('/backup/import', {
    method: 'POST',
    body: JSON.stringify(backup),
  });
}
