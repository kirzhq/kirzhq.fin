import type { Transaction, TransactionType, VehicleExpenseType } from './types';

export const FOOD = 'Еда';
export const CAR = 'Машина';
export const DEBTS = 'Долги';
export const FOOD_SUBCATEGORIES = ['Продукты', 'Доставка из ресторанов', 'Доставка из магазина', 'Ресторан', 'Перекус', 'Готовая еда'];

/** Fixed colors for the biggest categories, so they keep their color between months. */
const FIXED: Record<string, string> = {
  'Еда': 'var(--k3)', 'Машина': 'var(--k1)', 'Долги': 'var(--k10)', 'Здоровье': 'var(--k2)',
  'Такси/самики': 'var(--k5)', 'Транспорт': 'var(--k7)', 'Досуг': 'var(--k6)', 'Одежда': 'var(--k4)',
  'Для дома': 'var(--k8)', 'Подписки': 'var(--k9)',
};
const SPARE = ['var(--k11)', 'var(--k12)', 'var(--k13)', 'var(--k14)'];

export function categoryColor(name: string, type: TransactionType = 'EXPENSE') {
  if (type === 'INCOME') return 'var(--pos)';
  if (FIXED[name]) return FIXED[name];
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SPARE[hash % SPARE.length];
}

export function vehicleTypeLabel(value: VehicleExpenseType | null) {
  if (value === 'FUEL') return 'Бензин';
  if (value === 'MAINTENANCE') return 'Обслуживание';
  return 'Прочее';
}

export function operationDetails(item: Transaction) {
  const parts: string[] = [];
  if (item.foodSubcategory) parts.push(item.foodSubcategory);
  if (item.category === CAR) parts.push(vehicleTypeLabel(item.vehicleExpenseType));
  if (item.odometerKm != null) parts.push(`${item.odometerKm.toLocaleString('ru-RU')} км`);
  if (item.fuelLiters != null) parts.push(`${item.fuelLiters.toLocaleString('ru-RU')} л`);
  if (item.description) parts.push(item.description);
  return parts.join(' · ');
}

/** Categories ordered by how often they appear, the rest alphabetically. */
export function byUsage(names: string[], items: Transaction[]) {
  const counts = new Map<string, number>();
  items.forEach((item) => counts.set(item.category, (counts.get(item.category) ?? 0) + 1));
  return [...names].sort((left, right) => (counts.get(right) ?? 0) - (counts.get(left) ?? 0) || left.localeCompare(right, 'ru'));
}
