import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../components/Icon';
import { AmountInput, ConfirmButton, ErrorState, Field, Loading, PageHead, Sheet, Track } from '../components/ui';
import { dateLong, dateShort, money, parseAmount, plural, shiftIso, todayIso } from '../format';
import { errorText, useFinance } from '../store';
import type { Debt } from '../types';

type SheetState = { kind: 'debt'; debt?: Debt } | { kind: 'pay'; debt: Debt } | null;

export function Debts() {
  const { version } = useFinance();
  const [debts, setDebts] = useState<Debt[] | null>(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<SheetState>(null);

  const load = useCallback(() => api.debts().then((items) => { setDebts(items); setError(''); }).catch((requestError) => setError(errorText(requestError))), []);
  useEffect(() => { void load(); }, [load, version]);

  const active = (debts ?? []).filter((debt) => debt.remainingAmount > 0);
  const closed = (debts ?? []).filter((debt) => debt.remainingAmount === 0);
  const remaining = active.reduce((sum, debt) => sum + debt.remainingAmount, 0);
  const paid = (debts ?? []).reduce((sum, debt) => sum + debt.paidAmount, 0);
  const nextDue = active.filter((debt) => debt.dueDate && debt.overdueDays === 0).sort((left, right) => left.dueDate!.localeCompare(right.dueDate!))[0];
  const overdue = active.filter((debt) => debt.overdueDays > 0);

  return <>
    <PageHead kicker="Финансы" title="Долги">
      <button type="button" className="btn line" onClick={() => setSheet({ kind: 'debt' })}><Icon name="plus" />Новый долг</button>
    </PageHead>
    {error && !debts && <ErrorState text={error} onRetry={() => void load()} />}
    {!debts && !error && <Loading />}
    {debts && <>
      <section className="panel metrics">
        <div><span>Осталось погасить</span><b className="num">{money(remaining)}</b></div>
        <div><span>Уже погашено</span><b className="num pos">{money(paid)}</b></div>
        <div><span>Активных долгов</span><b className="num">{active.length}</b>{overdue.length > 0 && <small className="neg">{overdue.length} с просрочкой</small>}</div>
        <div><span>Ближайший срок</span><b className="num">{nextDue?.dueDate ? dateShort(nextDue.dueDate) : '—'}</b>{nextDue && <small>{nextDue.name}</small>}</div>
      </section>
      {debts.length === 0 && <section className="panel empty-panel"><Icon name="check" /><div><b>Долгов нет</b><p>Если появится кредит или рассрочка, добавьте его, чтобы видеть остаток и платежи.</p></div></section>}
      {active.length > 0 && <div className="cards">{active.map((debt) => <DebtCard key={debt.id} debt={debt} onEdit={() => setSheet({ kind: 'debt', debt })} onPay={() => setSheet({ kind: 'pay', debt })} />)}</div>}
      {closed.length > 0 && <details className="panel closed-list">
        <summary>Погашенные · {closed.length}</summary>
        <div className="cards">{closed.map((debt) => <DebtCard key={debt.id} debt={debt} onEdit={() => setSheet({ kind: 'debt', debt })} />)}</div>
      </details>}
      <div className="note"><Icon name="info" /><span>Платёж записывается расходом в категории «Долги». Если удалить такую операцию в журнале, сумма вернётся в остаток долга, перед удалением приложение об этом предупредит.</span></div>
    </>}
    {sheet?.kind === 'debt' && <DebtSheet debt={sheet.debt} onClose={() => setSheet(null)} onSaved={load} />}
    {sheet?.kind === 'pay' && <PaymentSheet debt={sheet.debt} onClose={() => setSheet(null)} />}
  </>;
}

function DebtCard({ debt, onEdit, onPay }: { debt: Debt; onEdit: () => void; onPay?: () => void }) {
  const closed = debt.remainingAmount === 0;
  return <section className="panel item">
    <div className="item-h">
      <div>
        <h3>{debt.name}{debt.overdueDays > 0 && <span className="pill over">просрочка {debt.overdueDays} {plural(debt.overdueDays, 'день', 'дня', 'дней')}</span>}
          {closed && <span className="pill ok">погашен</span>}</h3>
        <p>{debt.note || `с ${dateLong(debt.createdDate)}`}{debt.dueDate && !closed && debt.overdueDays === 0 ? ` · вернуть до ${dateShort(debt.dueDate)}` : ''}</p>
      </div>
      <button type="button" className="iconbtn" onClick={onEdit} aria-label={`Изменить долг ${debt.name}`}><Icon name="edit" /></button>
    </div>
    <div className="kv">
      <div><span>Осталось</span><b className="num">{money(debt.remainingAmount)}</b></div>
      <div><span>Погашено</span><b className="num">{money(debt.paidAmount)} <small>из {money(debt.initialAmount)}</small></b></div>
    </div>
    <Track percent={debt.progressPercent} tone="pos" />
    {onPay && !closed && <div className="row-actions"><button type="button" className="btn primary" onClick={onPay}>Внести платёж</button></div>}
    {debt.payments.length > 0 && <details className="hist">
      <summary><span>История платежей · {debt.payments.length}</span><Icon name="right" /></summary>
      {debt.payments.map((payment) => <p key={payment.id}><span>{dateShort(payment.paymentDate)}</span><b className="num">{money(payment.amount)}</b></p>)}
    </details>}
  </section>;
}

function DebtSheet({ debt, onClose, onSaved }: { debt?: Debt; onClose: () => void; onSaved: () => Promise<void> }) {
  const { toast } = useFinance();
  const [name, setName] = useState(debt?.name ?? '');
  const [amount, setAmount] = useState(debt ? String(debt.initialAmount).replace('.', ',') : '');
  const [createdDate, setCreatedDate] = useState(debt?.createdDate ?? todayIso());
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? '');
  const [note, setNote] = useState(debt?.note ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const initialAmount = parseAmount(amount);
    if (!name.trim()) { setError('Введите название'); return; }
    if (!(initialAmount > 0)) { setError('Введите сумму больше нуля'); return; }
    setBusy(true);
    try {
      const payload = { name: name.trim(), initialAmount, createdDate, note: note.trim(), dueDate: dueDate || null };
      if (debt) await api.updateDebt(debt.id, payload); else await api.createDebt(payload);
      toast(debt ? 'Долг сохранён' : 'Долг добавлен');
      onClose();
      await onSaved();
    } catch (requestError) { setError(errorText(requestError)); setBusy(false); }
  }

  async function remove() {
    if (!debt) return;
    setBusy(true);
    try {
      await api.deleteDebt(debt.id);
      toast('Долг удалён. Платежи остались в журнале как расходы.');
      onClose();
      await onSaved();
    } catch (requestError) { setError(errorText(requestError)); setBusy(false); }
  }

  return <Sheet title={debt ? 'Долг' : 'Новый долг'} onClose={onClose} onSubmit={() => void save()}>
    <Field label="Название"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, кредитная карта" maxLength={255} data-autofocus /></Field>
    <div className="field"><span>Сумма долга</span><AmountInput value={amount} onChange={setAmount} label="Сумма долга" autoFocus={false} /></div>
    <div className="two">
      <Field label="Когда появился"><input type="date" value={createdDate} onChange={(event) => setCreatedDate(event.target.value)} required /></Field>
      <Field label="Вернуть до"><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Field>
    </div>
    <Field label="Комментарий"><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Необязательно" maxLength={1000} /></Field>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="actions">
      {debt && <ConfirmButton label={<><Icon name="trash" />Удалить</>} confirmLabel="Удалить долг?" onConfirm={remove} disabled={busy} />}
      <button type="submit" className="btn primary" disabled={busy}>{debt ? 'Сохранить' : 'Добавить долг'}</button>
    </div>
  </Sheet>;
}

function PaymentSheet({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const { reload, toast } = useFinance();
  const today = todayIso();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const value = parseAmount(amount);
    if (!(value > 0)) { setError('Введите сумму больше нуля'); return; }
    if (value > debt.remainingAmount) { setError(`Остаток долга ${money(debt.remainingAmount)}, больше внести нельзя`); return; }
    setBusy(true);
    try {
      await api.payDebt(debt.id, { amount: value, paymentDate: date, comment: comment.trim() });
      toast(`Платёж ${money(value)} записан`);
      onClose();
      await reload();
    } catch (requestError) { setError(errorText(requestError)); setBusy(false); }
  }

  return <Sheet title={`Платёж · ${debt.name}`} onClose={onClose} onSubmit={() => void save()}>
    <AmountInput value={amount} onChange={setAmount} label="Сумма платежа" />
    <div className="chips">
      <button type="button" className="chip" onClick={() => setAmount(String(debt.remainingAmount).replace('.', ','))}>Весь остаток · {money(debt.remainingAmount)}</button>
    </div>
    <div className="field"><span>Дата</span>
      <div className="chips">
        <button type="button" className="chip" aria-pressed={date === today} onClick={() => setDate(today)}>Сегодня</button>
        <button type="button" className="chip" aria-pressed={date === shiftIso(today, -1)} onClick={() => setDate(shiftIso(today, -1))}>Вчера</button>
        <label className={`chip date-chip${date !== today && date !== shiftIso(today, -1) ? ' on' : ''}`}><Icon name="calendar" />
          <input type="date" value={date} max={today} onChange={(event) => event.target.value && setDate(event.target.value)} aria-label="Другая дата" /></label>
      </div>
    </div>
    <Field label="Комментарий"><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Необязательно" /></Field>
    <p className="muted small">Запишется расходом «Долги» и уменьшит остаток.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="actions"><button type="submit" className="btn primary" disabled={busy}>Записать платёж</button></div>
  </Sheet>;
}
