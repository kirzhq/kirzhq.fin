import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';
import { currentPeriod, periodKey } from './format';
import type { Category, CategoryBudget, Period, Summary, Transaction, Vehicle } from './types';

type PeriodData = { key: string; transactions: Transaction[]; summary: Summary };
export type OperationDraft = { operation?: Transaction; category?: string; vehicleExpenseType?: 'FUEL' };
type Toast = { id: number; text: string; error?: boolean };

type FinanceState = {
  period: Period;
  setPeriod: (period: Period) => void;
  /** Data of the selected period, or null while it is loading. Never data of another period. */
  data: PeriodData | null;
  loadError: string;
  categories: Category[];
  vehicles: Vehicle[];
  budgets: CategoryBudget[];
  /** Refetches the period data and everything that operations can change. */
  reload: () => Promise<void>;
  reloadReferences: () => Promise<void>;
  /** Increments after every saved change, so views with their own data (debts, goals) can refetch. */
  version: number;
  toast: (text: string, error?: boolean) => void;
  fail: (error: unknown) => void;
  toasts: Toast[];
  draft: OperationDraft | null;
  openOperation: (draft?: OperationDraft) => void;
  closeOperation: () => void;
};

const FinanceContext = createContext<FinanceState | null>(null);

export function useFinance() {
  const value = useContext(FinanceContext);
  if (!value) throw new Error('useFinance outside FinanceProvider');
  return value;
}

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Что-то пошло не так';
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>(currentPeriod);
  const [data, setData] = useState<PeriodData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [draft, setDraft] = useState<OperationDraft | null>(() =>
    new URLSearchParams(window.location.search).get('quickAdd') === '1' ? {} : null);
  const cache = useRef(new Map<string, PeriodData>());
  const toastId = useRef(0);

  const toast = useCallback((text: string, error = false) => {
    const id = ++toastId.current;
    setToasts((current) => [...current.slice(-2), { id, text, error }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), error ? 6000 : 2600);
  }, []);
  const fail = useCallback((error: unknown) => toast(errorText(error), true), [toast]);

  const loadPeriod = useCallback(async (target: Period, signal?: AbortSignal) => {
    const key = periodKey(target);
    const [transactions, summary] = await Promise.all([api.transactions(target, signal), api.summary(target, signal)]);
    const fresh = { key, transactions, summary };
    cache.current.set(key, fresh);
    return fresh;
  }, []);

  useEffect(() => {
    const key = periodKey(period);
    const cached = cache.current.get(key);
    setData(cached ?? null);
    setLoadError('');
    const controller = new AbortController();
    loadPeriod(period, controller.signal)
      .then((fresh) => { if (!controller.signal.aborted) setData(fresh); })
      .catch((error) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
        if (!cached) setLoadError(errorText(error));
        else toast(errorText(error), true);
      });
    return () => controller.abort();
  }, [period, loadPeriod, toast]);

  const reloadReferences = useCallback(async () => {
    const [categoryItems, vehicleItems, budgetItems] = await Promise.all([api.categories(), api.vehicles(), api.budgets()]);
    setCategories(categoryItems);
    setVehicles(vehicleItems);
    setBudgets(budgetItems);
  }, []);

  useEffect(() => { reloadReferences().catch(fail); }, [reloadReferences, fail]);

  const periodRef = useRef(period);
  periodRef.current = period;
  const reload = useCallback(async () => {
    cache.current.clear();
    setVersion((value) => value + 1);
    const target = periodRef.current;
    const fresh = await loadPeriod(target);
    if (periodKey(periodRef.current) === fresh.key) setData(fresh);
  }, [loadPeriod]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('quickAdd') !== '1') return;
    url.searchParams.delete('quickAdd');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const value = useMemo<FinanceState>(() => ({
    period, setPeriod, data, loadError, categories, vehicles, budgets, reload, reloadReferences, version,
    toast, fail, toasts, draft,
    openOperation: (next = {}) => setDraft(next),
    closeOperation: () => setDraft(null),
  }), [period, data, loadError, categories, vehicles, budgets, reload, reloadReferences, version, toast, fail, toasts, draft]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}
