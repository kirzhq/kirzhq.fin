import type { Summary, Transaction } from './types';

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

export function getTransactions() {
  return request<Transaction[]>('/transactions');
}

export function getSummary() {
  return request<Summary>('/summary');
}

export function createTransaction(payload: Omit<Transaction, 'id'>) {
  return request<Transaction>('/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
