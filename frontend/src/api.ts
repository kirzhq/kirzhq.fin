import type {
  Category, CategoryBudget, Debt, DebtPayload, Period, SavingsGoal, SavingsGoalPayload, Summary, Transaction,
  TransactionPayload, TransactionType, Vehicle, VehicleSummary,
} from './types';

const API_BASE = '/api';

function csrfToken() {
  const raw = document.cookie.split('; ')
    .find((value) => value.startsWith('XSRF-TOKEN='))
    ?.split('=').slice(1).join('=');
  return raw ? decodeURIComponent(raw) : undefined;
}

function ensureAuthenticated(response: Response) {
  if (response.status === 401 || (response.redirected && response.url.includes('/login'))) {
    window.location.assign(`https://home.kirzhq.ru/login?continue=${encodeURIComponent(window.location.href)}`);
    throw new Error('Нужно войти заново');
  }
}

async function errorMessage(response: Response) {
  try {
    const body = await response.json() as { message?: string };
    if (body?.message) return body.message;
  } catch {
    // The body is not JSON (proxy error page, empty response).
  }
  if (response.status >= 500) return 'Сервер не ответил как надо. Попробуйте ещё раз через минуту.';
  return `Запрос не выполнен (код ${response.status})`;
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const token = csrfToken();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (init.body) headers['Content-Type'] = 'application/json';
  if (token && init.method && init.method !== 'GET') headers['X-XSRF-TOKEN'] = token;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('Нет связи с сервером. Проверьте интернет.');
  }
  ensureAuthenticated(response);
  if (!response.ok) throw new Error(await errorMessage(response));
  return response;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  return (await send(path, init)).json() as Promise<T>;
}

const body = (method: string, payload: unknown): RequestInit => ({ method, body: JSON.stringify(payload) });

function periodQuery({ year, month }: Period) {
  const params = new URLSearchParams({ year: String(year) });
  if (month) params.set('month', String(month));
  return params.toString();
}

export const api = {
  transactions: (period: Period, signal?: AbortSignal, includeExcluded = false) =>
    json<Transaction[]>(`/transactions?${periodQuery(period)}${includeExcluded ? '&includeExcluded=true' : ''}`, { signal }),
  summary: (period: Period, signal?: AbortSignal) => json<Summary>(`/summary?${periodQuery(period)}`, { signal }),
  createTransaction: (payload: TransactionPayload) => json<Transaction>('/transactions', body('POST', payload)),
  updateTransaction: (id: number, payload: TransactionPayload) => json<Transaction>(`/transactions/${id}`, body('PUT', payload)),
  deleteTransaction: (id: number) => send(`/transactions/${id}`, { method: 'DELETE' }),

  categories: () => json<Category[]>('/categories'),
  createCategory: (name: string, type: TransactionType) => json<Category>('/categories', body('POST', { name, type })),
  renameCategory: (id: number, name: string) => json<Category>(`/categories/${id}`, body('PUT', { name })),
  deleteCategory: (id: number, moveTo?: string) =>
    send(`/categories/${id}${moveTo ? `?moveTo=${encodeURIComponent(moveTo)}` : ''}`, { method: 'DELETE' }),

  budgets: () => json<CategoryBudget[]>('/budgets'),
  saveBudget: (category: string, monthlyLimit: number) => json<CategoryBudget>('/budgets', body('PUT', { category, monthlyLimit })),
  deleteBudget: (id: number) => send(`/budgets/${id}`, { method: 'DELETE' }),

  vehicles: () => json<Vehicle[]>('/vehicles'),
  vehicleSummary: (id: number, year: number) => json<VehicleSummary>(`/vehicles/${id}/summary?year=${year}`),
  exportVehicle: (id: number, year: number) => download(`/vehicles/${id}/export?year=${year}`, `vehicle-${year}.xlsx`),

  debts: () => json<Debt[]>('/debts'),
  createDebt: (payload: DebtPayload) => json<Debt>('/debts', body('POST', payload)),
  updateDebt: (id: number, payload: DebtPayload) => json<Debt>(`/debts/${id}`, body('PUT', payload)),
  deleteDebt: (id: number) => send(`/debts/${id}`, { method: 'DELETE' }),
  payDebt: (id: number, payload: { amount: number; paymentDate: string; comment: string }) =>
    json<Debt>(`/debts/${id}/payments`, body('POST', payload)),

  savings: () => json<SavingsGoal[]>('/savings'),
  createGoal: (payload: SavingsGoalPayload) => json<SavingsGoal>('/savings', body('POST', payload)),
  updateGoal: (id: number, payload: SavingsGoalPayload) => json<SavingsGoal>(`/savings/${id}`, body('PUT', payload)),
  deleteGoal: (id: number) => send(`/savings/${id}`, { method: 'DELETE' }),
  addEntry: (id: number, payload: { amount: number; entryDate: string; comment: string; withdrawal: boolean }) =>
    json<SavingsGoal>(`/savings/${id}/entries`, body('POST', payload)),
  deleteEntry: (goalId: number, entryId: number) => send(`/savings/${goalId}/entries/${entryId}`, { method: 'DELETE' }),

  exportBackup: () => download('/backup/export', 'kirzhq-fin-backup.json'),
  async importBackup(file: File) {
    let backup: unknown;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      throw new Error('Файл не похож на резервную копию: это не JSON');
    }
    return json<{ imported: boolean }>('/backup/import', body('POST', backup));
  },
};

async function download(path: string, fallbackName: string) {
  const response = await send(path);
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
