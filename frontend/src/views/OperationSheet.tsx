import { useMemo, useState } from 'react';
import { api } from '../api';
import { byUsage, CAR, categoryColor, FOOD, FOOD_SUBCATEGORIES } from '../categories';
import { AmountInput, ConfirmButton, Field, Sheet } from '../components/ui';
import { Icon } from '../components/Icon';
import { money, parseAmount, shiftIso, todayIso } from '../format';
import { errorText, useFinance } from '../store';
import type { OperationDraft } from '../store';
import type { TransactionPayload, TransactionType, VehicleExpenseType } from '../types';

/** Last used type, category and date stay between new operations during a session. */
const memory: { type: TransactionType; category: string; date: string | null } = { type: 'EXPENSE', category: FOOD, date: null };
const CHIP_COUNT = 8;

export function OperationSheet({ draft }: { draft: OperationDraft }) {
  const { categories, vehicles, data, reload, closeOperation, toast } = useFinance();
  const editing = draft.operation;
  const today = todayIso();
  const [type, setType] = useState<TransactionType>(editing?.type ?? (draft.category ? 'EXPENSE' : memory.type));
  const [category, setCategory] = useState(editing?.category ?? draft.category ?? memory.category);
  const [amount, setAmount] = useState(editing ? String(editing.amount).replace('.', ',') : '');
  const [date, setDate] = useState(editing?.transactionDate ?? memory.date ?? today);
  const [description, setDescription] = useState(editing?.description ?? '');
  const [food, setFood] = useState(editing?.foodSubcategory ?? 'Продукты');
  const [carType, setCarType] = useState<VehicleExpenseType>(editing?.vehicleExpenseType ?? draft.vehicleExpenseType ?? 'FUEL');
  const [odometer, setOdometer] = useState(editing?.odometerKm != null ? String(editing.odometerKm) : '');
  const [fuel, setFuel] = useState(editing?.fuelLiters != null ? String(editing.fuelLiters).replace('.', ',') : '');
  const [vehicleId, setVehicleId] = useState<number | null>(editing?.vehicleId ?? vehicles[0]?.id ?? null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const debtName = editing?.debtName ?? null;

  const names = useMemo(() => categories.filter((item) => item.type === type).map((item) => item.name), [categories, type]);
  const ordered = useMemo(() => byUsage(names, data?.transactions ?? []), [names, data]);
  const chips = ordered.slice(0, CHIP_COUNT);
  if (category && names.includes(category) && !chips.includes(category)) chips[chips.length - 1] = category;
  const rest = ordered.filter((name) => !chips.includes(name)).sort((left, right) => left.localeCompare(right, 'ru'));
  const lastOdometer = useMemo(() => (data?.transactions ?? []).find((item) => item.odometerKm != null)?.odometerKm ?? null, [data]);

  function switchType(next: TransactionType) {
    setType(next);
    const available = categories.filter((item) => item.type === next).map((item) => item.name);
    if (!available.includes(category)) setCategory(byUsage(available, data?.transactions ?? [])[0] ?? '');
  }

  async function save() {
    const value = parseAmount(amount);
    if (!(value > 0)) { setError('Введите сумму больше нуля'); return; }
    if (!category) { setError('Выберите категорию'); return; }
    const isCar = type === 'EXPENSE' && category === CAR;
    const fuelValue = parseAmount(fuel);
    const odometerValue = Number(odometer.replace(/\s/g, ''));
    const payload: TransactionPayload = {
      type, category, amount: value, transactionDate: date, description: description.trim(),
      foodSubcategory: type === 'EXPENSE' && category === FOOD ? food : null,
      vehicleId: isCar ? vehicleId : null,
      vehicleExpenseType: isCar ? carType : null,
      odometerKm: isCar && carType === 'FUEL' && odometer.trim() ? odometerValue : null,
      fuelLiters: isCar && carType === 'FUEL' && fuel.trim() ? fuelValue : null,
    };
    setSaving(true);
    setError('');
    try {
      if (editing) await api.updateTransaction(editing.id, payload);
      else await api.createTransaction(payload);
      if (!editing) Object.assign(memory, { type, category, date: date === today ? null : date });
      closeOperation();
      toast(editing ? 'Изменения сохранены' : `Добавлено: ${category}, ${money(value)}`);
      await reload();
    } catch (requestError) {
      setError(errorText(requestError));
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.deleteTransaction(editing.id);
      closeOperation();
      toast(debtName ? `Операция удалена, долг «${debtName}» вырос на ${money(editing.amount)}` : 'Операция удалена');
      await reload();
    } catch (requestError) {
      setError(errorText(requestError));
      setSaving(false);
    }
  }

  return <Sheet title={editing ? 'Операция' : 'Новая операция'} onClose={closeOperation} onSubmit={() => void save()}>
    {!debtName && <div className="seg" role="group" aria-label="Тип операции">
      <button type="button" aria-pressed={type === 'EXPENSE'} onClick={() => switchType('EXPENSE')}>Расход</button>
      <button type="button" aria-pressed={type === 'INCOME'} onClick={() => switchType('INCOME')}>Доход</button>
    </div>}
    <AmountInput value={amount} onChange={setAmount} label="Сумма" />

    {debtName
      ? <div className="note"><Icon name="info" /><span>Платёж по долгу «{debtName}». Сумму, дату и комментарий менять можно, категорию нельзя.</span></div>
      : <div className="field"><span>Категория</span>
        <div className="chips">
          {chips.map((name) => <button type="button" key={name} className="chip" aria-pressed={category === name} onClick={() => setCategory(name)}>
            <i className="dot" style={{ background: categoryColor(name, type) }} />{name}
          </button>)}
          {rest.length > 0 && <select className="chip select-chip" value={rest.includes(category) ? category : ''} aria-label="Другие категории"
            onChange={(event) => event.target.value && setCategory(event.target.value)}>
            <option value="">Ещё…</option>
            {rest.map((name) => <option key={name}>{name}</option>)}
          </select>}
        </div>
      </div>}

    {type === 'EXPENSE' && category === FOOD && <div className="field"><span>Что именно</span>
      <div className="chips">{FOOD_SUBCATEGORIES.map((name) => <button type="button" key={name} className="chip" aria-pressed={food === name} onClick={() => setFood(name)}>{name}</button>)}</div>
    </div>}

    {type === 'EXPENSE' && category === CAR && <>
      <div className="field"><span>Тип расхода</span>
        <div className="seg">
          {(['FUEL', 'MAINTENANCE', 'OTHER'] as const).map((value) => <button type="button" key={value} aria-pressed={carType === value} onClick={() => setCarType(value)}>
            {value === 'FUEL' ? 'Бензин' : value === 'MAINTENANCE' ? 'Обслуживание' : 'Прочее'}
          </button>)}
        </div>
      </div>
      {carType === 'FUEL' && <div className="two">
        <Field label="Одометр, км"><input value={odometer} onChange={(event) => setOdometer(event.target.value.replace(/[^\d\s]/g, ''))} inputMode="numeric"
          placeholder={lastOdometer ? `было ${lastOdometer.toLocaleString('ru-RU')}` : 'например, 36 410'} /></Field>
        <Field label="Литров"><input value={fuel} onChange={(event) => setFuel(event.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" placeholder="27,4" /></Field>
      </div>}
      {carType === 'FUEL' && <small className="muted hint">Чтобы считать расход на 100 км, заполняйте оба поля на каждой заправке.</small>}
      {vehicles.length > 1 && <Field label="Автомобиль">
        <select value={vehicleId ?? ''} onChange={(event) => setVehicleId(Number(event.target.value))}>
          {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}
        </select>
      </Field>}
    </>}

    <div className="field"><span>Дата</span>
      <div className="chips">
        <button type="button" className="chip" aria-pressed={date === today} onClick={() => setDate(today)}>Сегодня</button>
        <button type="button" className="chip" aria-pressed={date === shiftIso(today, -1)} onClick={() => setDate(shiftIso(today, -1))}>Вчера</button>
        <label className={`chip date-chip${date !== today && date !== shiftIso(today, -1) ? ' on' : ''}`}>
          <Icon name="calendar" />
          <input type="date" value={date} max={today} onChange={(event) => event.target.value && setDate(event.target.value)} aria-label="Другая дата" />
        </label>
      </div>
    </div>
    <Field label="Комментарий"><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Необязательно" maxLength={255} /></Field>

    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="actions">
      {editing && <ConfirmButton label={<><Icon name="trash" />Удалить</>}
        confirmLabel={debtName ? `Удалить и вернуть ${money(editing.amount)} в долг` : 'Точно удалить?'} onConfirm={remove} disabled={saving} />}
      <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Сохраняем…' : editing ? 'Сохранить' : 'Добавить'}</button>
    </div>
  </Sheet>;
}

