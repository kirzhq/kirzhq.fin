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

  // One-time payments without a date or due after this month are «ahead»; everything else belongs to this month.
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-31`;
  const isAhead = (item: RequiredPayment) => item.kind === 'ONCE' && item.status !== 'PAID' && (!item.dueDate || item.dueDate > monthEnd);
  const thisMonth = (items ?? []).filter((item) => !isAhead(item));
  const ahead = (items ?? []).filter(isAhead)
    .sort((left, right) => (left.dueDate ?? '9999').localeCompare(right.dueDate ?? '9999') || left.name.localeCompare(right.name, 'ru'));
  const unpaid = thisMonth.filter((item) => item.status !== 'PAID')
    .sort((left, right) => (left.dueDate ?? '').localeCompare(right.dueDate ?? '') || left.name.localeCompare(right.name, 'ru'));
  const paid = thisMonth.filter((item) => item.status === 'PAID');
  const left = unpaid.reduce((sum, item) => sum + item.amount, 0);
  const total = thisMonth.reduce((sum, item) => sum + (item.paidAmount ?? item.amount), 0);
  const aheadTotal = ahead.reduce((sum, item) => sum + item.amount, 0);
  const afterThem = summary.income - summary.expense - left;
  const running = summary.forecastAvailable;

  function row(item: RequiredPayment) {
    return <div className="row required" key={item.id}>
      <i className="dot" style={{ background: categoryColor(item.category) }} />
      <button type="button" className="grow required-name" onClick={() => setSheet({ kind: 'edit', payment: item })} aria-label={`Изменить «${item.name}»`}>
        <span className="t">{item.name}</span>
        <span className="s">{statusText(item)}</span>
      </button>
      <span className="num">{money(item.paidAmount ?? item.amount)}</span>
      {item.status === 'PAID'
        ? <ConfirmButton className="btn mini-btn" label="Отменить" confirmLabel="Удалить операцию?" onConfirm={() => undo(item)} />
        : <button type="button" className={`btn mini-btn ${item.status === 'OVERDUE' ? 'primary' : 'line'}`} onClick={() => setSheet({ kind: 'pay', payment: item })}>Оплатить</button>}
    </div>;
  }

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
    {items && items.length === 0 && <p className="empty">Сюда добавляются траты, о которых знаешь заранее: каждый месяц (аренда, связь, подписки) или один раз, даже если дата пока неизвестна.</p>}
    {thisMonth.length > 0 && <>
      <p className="required-sum">
        {left > 0
          ? <>Осталось оплатить <b className="num">{money(left)}</b> из {moneyRounded(total)}</>
          : <>Всё оплачено, <span className="num">{moneyRounded(total)}</span></>}
        {running && left > 0 && <span className="muted small">После них останется <span className={`num ${afterThem < 0 ? 'neg' : ''}`}>{money(afterThem, true)}</span> от сальдо месяца.</span>}
      </p>
      <div className="rows">{[...unpaid, ...paid].map((item) => row(item))}</div>
    </>}
    {ahead.length > 0 && <>
      <p className="required-sum ahead">Предстоящие <span className="ahead-sum num">· {money(aheadTotal)}</span>
        <span className="muted small">Разовые траты без даты или позже этого месяца, в остаток месяца не входят.</span></p>
      <div className="rows">{ahead.map((item) => row(item))}</div>
    </>}
    {sheet?.kind === 'edit' && <RequiredSheet payment={sheet.payment} onClose={() => setSheet(null)} onSaved={() => load()} />}
    {sheet?.kind === 'pay' && <PaySheet payment={sheet.payment} year={year} month={month} onClose={() => setSheet(null)} />}
  </section>;
}

function statusText(item: RequiredPayment) {
  const once = item.kind === 'ONCE' ? 'Разовый · ' : '';
  if (item.status === 'PAID') return <><span className="pill ok">оплачен</span> {item.paidDate ? dateShort(item.paidDate) : ''}</>;
  if (!item.dueDate) return `${once}дата пока неизвестна`;
  if (item.status === 'OVERDUE') {
    const days = Math.round((Date.parse(todayIso()) - Date.parse(item.dueDate)) / 86_400_000);
    return <><span className="pill over">просрочен</span> {days > 0 ? `на ${days} ${plural(days, 'день', 'дня', 'дней')}, ` : ''}срок {dateShort(item.dueDate)}</>;
  }
  return `${once}${item.dueDate === todayIso() ? 'сегодня' : `до ${dateShort(item.dueDate)}`}`;
}

function RequiredSheet({ payment, onClose, onSaved }: { payment?: RequiredPayment; onClose: () => void; onSaved: () => Promise<void> }) {
  const { categories, toast } = useFinance();
  const choices = categories.filter((item) => item.type === 'EXPENSE' && !NOT_ALLOWED.includes(item.name));
  const [name, setName] = useState(payment?.name ?? '');
  const [category, setCategory] = useState(payment?.category ?? '');
  const [amount, setAmount] = useState(payment ? amountText(payment.amount) : '');
  const [kind, setKind] = useState<'MONTHLY' | 'ONCE'>(payment?.kind ?? 'MONTHLY');
  const [day, setDay] = useState(payment?.dayOfMonth ? String(payment.dayOfMonth) : '');
  const [dueDate, setDueDate] = useState(payment?.kind === 'ONCE' ? payment.dueDate ?? '' : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const value = parseAmount(amount);
    const dayOfMonth = Number(day);
    if (!name.trim()) { setError('Введите название'); return; }
    if (!category) { setError('Выберите категорию'); return; }
    if (!(value > 0)) { setError('Введите сумму больше нуля'); return; }
    if (kind === 'MONTHLY' && (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)) { setError('Число месяца: от 1 до 31'); return; }
    setBusy(true);
    try {
      const payload = kind === 'MONTHLY'
        ? { kind, name: name.trim(), category, amount: value, dayOfMonth, dueDate: null }
        : { kind, name: name.trim(), category, amount: value, dayOfMonth: null, dueDate: dueDate || null };
      if (payment) await api.updateRequired(payment.id, payload); else await api.createRequired(payload);
      toast(payment ? 'Платёж сохранён' : `«${payload.name}» добавлен`);
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

  return <Sheet title={payment ? 'Платёж' : 'Новый платёж'} onClose={onClose} onSubmit={() => void save()}>
    <div className="seg" role="group" aria-label="Как часто">
      <button type="button" aria-pressed={kind === 'MONTHLY'} onClick={() => setKind('MONTHLY')}>Каждый месяц</button>
      <button type="button" aria-pressed={kind === 'ONCE'} onClick={() => setKind('ONCE')}>Один раз</button>
    </div>
    <Field label="Название"><input value={name} onChange={(event) => setName(event.target.value)}
      placeholder={kind === 'MONTHLY' ? 'Например, аренда или интернет' : 'Например, страховка или виза'} maxLength={255} data-autofocus /></Field>
    <div className="field"><span>{kind === 'MONTHLY' ? 'Сумма в месяц' : 'Сумма'}</span><AmountInput value={amount} onChange={setAmount} label="Сумма" autoFocus={false} /></div>
    <div className="two">
      <Field label="Категория">
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Выберите…</option>
          {choices.map((item) => <option key={item.id}>{item.name}</option>)}
        </select>
      </Field>
      {kind === 'MONTHLY'
        ? <Field label="Число месяца">
          <input value={day} onChange={(event) => setDay(event.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="Например, 5" />
        </Field>
        : <Field label="Когда">
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </Field>}
    </div>
    <p className="muted small form-note">{kind === 'MONTHLY'
      ? 'Если в месяце нет такого числа, срок будет в последний день.'
      : 'Дату можно не указывать. Тогда платёж будет в «Предстоящих», пока не оплатишь.'}</p>
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
