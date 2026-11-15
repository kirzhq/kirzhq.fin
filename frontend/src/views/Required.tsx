import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { CAR, categoryColor, FOOD } from '../categories';
import { Icon } from '../components/Icon';
import { AmountInput, ConfirmButton, Field, Sheet } from '../components/ui';
import { amountText, dateShort, money, moneyRounded, parseAmount, plural, shiftIso, todayIso } from '../format';
import { errorText, useFinance } from '../store';
import type { RequiredPayment, Summary } from '../types';

/** Categories whose operations need extra fields (vehicle, food subcategory); the server refuses them too. */
const NOT_ALLOWED = [FOOD, CAR];

type SheetState = { kind: 'edit'; payment?: RequiredPayment } | { kind: 'pay'; payment: RequiredPayment } | null;

/** Monthly mandatory payments of the selected month: what is paid, what is due, and what is left after them. */
export function RequiredPanel({ year, month, summary }: { year: number; month: number; summary: Summary }) {
  const { version, reload, toast, fail } = useFinance();
  const [items, setItems] = useState<RequiredPayment[] | null>(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<SheetState>(null);

  const load = useCallback((signal?: AbortSignal) => api.requiredPayments(year, month, signal)
    .then((list) => { setItems(list); setError(''); })
    .catch((requestError) => {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
      setError(errorText(requestError));
    }), [year, month]);

  useEffect(() => {
    setItems(null);
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, version]);

  const unpaid = (items ?? []).filter((item) => item.status !== 'PAID');
  const paid = (items ?? []).filter((item) => item.status === 'PAID');
  const left = unpaid.reduce((sum, item) => sum + item.amount, 0);
  const total = (items ?? []).reduce((sum, item) => sum + (item.paidAmount ?? item.amount), 0);
  const afterThem = summary.income - summary.expense - left;
  const running = summary.forecastAvailable;

  async function undo(item: RequiredPayment) {
    if (!item.transactionId) return;
    try {
      await api.deleteTransaction(item.transactionId);
      toast(`Оплата «${item.name}» отменена, операция удалена`);
      await reload();
    } catch (requestError) { fail(requestError); }
  }

  return <section className="panel">
    <div className="panel-h"><h2>Обязательные платежи</h2>
      <button type="button" className="link" onClick={() => setSheet({ kind: 'edit' })}><Icon name="plus" />Добавить</button></div>
    {error && <p className="form-error" role="alert">{error} <button type="button" className="link small" onClick={() => void load()}>Повторить</button></p>}
    {!items && !error && <p className="empty">Загружаем…</p>}
    {items && items.length === 0 && <p className="empty">Здесь будут платежи, которые повторяются каждый месяц: аренда, связь, подписки. Добавьте их, чтобы видеть, сколько ещё отдать до конца месяца.</p>}
    {items && items.length > 0 && <>
      <p className="required-sum">
        {left > 0
          ? <>Осталось оплатить <b className="num">{money(left)}</b> из {moneyRounded(total)}</>
          : <>Всё оплачено, <span className="num">{moneyRounded(total)}</span></>}
        {running && left > 0 && <span className="muted small">После них останется <span className={`num ${afterThem < 0 ? 'neg' : ''}`}>{money(afterThem, true)}</span> от сальдо месяца.</span>}
      </p>
      <div className="rows">
        {[...unpaid, ...paid].map((item) => <div className="row required" key={item.id}>
          <i className="dot" style={{ background: categoryColor(item.category) }} />
          <button type="button" className="grow required-name" onClick={() => setSheet({ kind: 'edit', payment: item })} aria-label={`Изменить «${item.name}»`}>
            <span className="t">{item.name}</span>
            <span className="s">{statusText(item)}</span>
          </button>
          <span className="num">{money(item.paidAmount ?? item.amount)}</span>
          {item.status === 'PAID'
            ? <ConfirmButton className="btn mini-btn" label="Отменить" confirmLabel="Удалить операцию?" onConfirm={() => undo(item)} />
            : <button type="button" className={`btn mini-btn ${item.status === 'OVERDUE' ? 'primary' : 'line'}`} onClick={() => setSheet({ kind: 'pay', payment: item })}>Оплатить</button>}
        </div>)}
      </div>
    </>}
    {sheet?.kind === 'edit' && <RequiredSheet payment={sheet.payment} onClose={() => setSheet(null)} onSaved={() => load()} />}
    {sheet?.kind === 'pay' && <PaySheet payment={sheet.payment} year={year} month={month} onClose={() => setSheet(null)} />}
  </section>;
}

function statusText(item: RequiredPayment) {
  if (item.status === 'PAID') return <><span className="pill ok">оплачен</span> {item.paidDate ? dateShort(item.paidDate) : ''}</>;
  if (item.status === 'OVERDUE') {
    const days = Math.round((Date.parse(todayIso()) - Date.parse(item.dueDate)) / 86_400_000);
    return <><span className="pill over">просрочен</span> {days > 0 ? `на ${days} ${plural(days, 'день', 'дня', 'дней')}, ` : ''}срок {dateShort(item.dueDate)}</>;
  }
  return item.dueDate === todayIso() ? 'Сегодня' : `До ${dateShort(item.dueDate)}`;
}

function RequiredSheet({ payment, onClose, onSaved }: { payment?: RequiredPayment; onClose: () => void; onSaved: () => Promise<void> }) {
  const { categories, toast } = useFinance();
  const choices = categories.filter((item) => item.type === 'EXPENSE' && !NOT_ALLOWED.includes(item.name));
  const [name, setName] = useState(payment?.name ?? '');
  const [category, setCategory] = useState(payment?.category ?? '');
  const [amount, setAmount] = useState(payment ? amountText(payment.amount) : '');
  const [day, setDay] = useState(payment ? String(payment.dayOfMonth) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const value = parseAmount(amount);
    const dayOfMonth = Number(day);
    if (!name.trim()) { setError('Введите название'); return; }
    if (!category) { setError('Выберите категорию'); return; }
    if (!(value > 0)) { setError('Введите сумму больше нуля'); return; }
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) { setError('День месяца: число от 1 до 31'); return; }
    setBusy(true);
    try {
      const payload = { name: name.trim(), category, amount: value, dayOfMonth };
      if (payment) await api.updateRequired(payment.id, payload); else await api.createRequired(payload);
      toast(payment ? 'Платёж сохранён' : `«${payload.name}» добавлен в обязательные`);
      onClose();
      await onSaved();
    } catch (requestError) { setError(errorText(requestError)); setBusy(false); }
  }

  async function remove() {
    if (!payment) return;
    setBusy(true);
    try {
      await api.deleteRequired(payment.id);
      toast('Платёж убран из обязательных. Прошлые оплаты остались в операциях.');
      onClose();
      await onSaved();
    } catch (requestError) { setError(errorText(requestError)); setBusy(false); }
  }

  return <Sheet title={payment ? 'Обязательный платёж' : 'Новый обязательный платёж'} onClose={onClose} onSubmit={() => void save()}>
    <Field label="Название"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, аренда или интернет" maxLength={255} data-autofocus /></Field>
    <div className="field"><span>Сумма в месяц</span><AmountInput value={amount} onChange={setAmount} label="Сумма в месяц" autoFocus={false} /></div>
    <div className="two">
      <Field label="Категория">
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Выберите…</option>
          {choices.map((item) => <option key={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <Field label="Платить до" hint="Число месяца; 31 значит последний день">
        <input value={day} onChange={(event) => setDay(event.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="5" />
      </Field>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="actions">
      {payment && <ConfirmButton label={<><Icon name="trash" />Удалить</>} confirmLabel="Убрать платёж?" onConfirm={remove} disabled={busy} />}
      <button type="submit" className="btn primary" disabled={busy}>{payment ? 'Сохранить' : 'Добавить'}</button>
    </div>
  </Sheet>;
}

function PaySheet({ payment, year, month, onClose }: { payment: RequiredPayment; year: number; month: number; onClose: () => void }) {
  const { reload, toast } = useFinance();
  const today = todayIso();
  const [amount, setAmount] = useState(amountText(payment.amount));
  const [date, setDate] = useState(today);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const value = parseAmount(amount);
    if (!(value > 0)) { setError('Введите сумму больше нуля'); return; }
    setBusy(true);
    try {
      await api.payRequired(payment.id, { year, month, amount: value, paymentDate: date });
      toast(`«${payment.name}» оплачен, ${money(value)}`);
      onClose();
      await reload();
    } catch (requestError) { setError(errorText(requestError)); setBusy(false); }
  }

  return <Sheet title={`Оплата · ${payment.name}`} onClose={onClose} onSubmit={() => void save()}>
    <AmountInput value={amount} onChange={setAmount} label="Сумма оплаты" />
    <div className="field"><span>Дата</span>
      <div className="chips">
        <button type="button" className="chip" aria-pressed={date === today} onClick={() => setDate(today)}>Сегодня</button>
        <button type="button" className="chip" aria-pressed={date === shiftIso(today, -1)} onClick={() => setDate(shiftIso(today, -1))}>Вчера</button>
        <label className={`chip date-chip${date !== today && date !== shiftIso(today, -1) ? ' on' : ''}`}><Icon name="calendar" />
          <input type="date" value={date} max={today} onChange={(event) => event.target.value && setDate(event.target.value)} aria-label="Другая дата" /></label>
      </div>
    </div>
    <p className="muted small">Запишется расходом «{payment.category}» и закроет платёж за этот месяц, даже если дата из другого месяца.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="actions"><button type="submit" className="btn primary" disabled={busy}>Записать оплату</button></div>
  </Sheet>;
}
