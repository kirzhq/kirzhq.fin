import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../components/Icon';
import { AmountInput, ConfirmButton, ErrorState, Field, Loading, PageHead, Sheet } from '../components/ui';
import { dateShort, money, moneyRounded, MONTHS_GENITIVE, parseAmount, parseIso, todayIso } from '../format';
import { errorText, useFinance } from '../store';
import type { SavingsGoal } from '../types';

/** Stored as hex in the database; each reads on both light and dark backgrounds. */
const GOAL_COLORS = ['#3B73D9', '#2E9E6B', '#D56A2C', '#C24D76', '#7F6AD6', '#1F9A9A'];

type SheetState = { kind: 'goal'; goal?: SavingsGoal } | { kind: 'entry'; goal: SavingsGoal; withdrawal: boolean } | null;

export function Goals() {
  const { version } = useFinance();
  const [goals, setGoals] = useState<SavingsGoal[] | null>(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<SheetState>(null);

  const load = useCallback(() => api.savings().then((items) => { setGoals(items); setError(''); }).catch((requestError) => setError(errorText(requestError))), []);
  useEffect(() => { void load(); }, [load, version]);

  const saved = (goals ?? []).reduce((sum, goal) => sum + goal.savedAmount, 0);
  const target = (goals ?? []).reduce((sum, goal) => sum + goal.targetAmount, 0);
  const thisMonth = todayIso().slice(0, 7);
  const monthAdded = (goals ?? []).flatMap((goal) => goal.entries).filter((entry) => entry.entryDate.startsWith(thisMonth)).reduce((sum, entry) => sum + entry.amount, 0);

  return <>
    <PageHead kicker="Финансы" title="Накопления">
      <button type="button" className="btn line" onClick={() => setSheet({ kind: 'goal' })}><Icon name="plus" />Новая цель</button>
    </PageHead>
    {error && !goals && <ErrorState text={error} onRetry={() => void load()} />}
    {!goals && !error && <Loading />}
    {goals && <>
      <section className="panel metrics">
        <div><span>Накоплено</span><b className="num pos">{money(saved)}</b></div>
        <div><span>Общая цель</span><b className="num">{money(target)}</b></div>
        <div><span>Осталось</span><b className="num">{money(Math.max(0, target - saved))}</b></div>
        <div><span>За этот месяц</span><b className="num">{money(monthAdded, true)}</b></div>
      </section>
      {goals.length === 0 && <section className="panel empty-panel"><Icon name="goal" /><div><b>Целей пока нет</b><p>Начните с финансовой подушки: три месяца обычных расходов.</p></div></section>}
      <div className="cards">{goals.map((goal) => <GoalCard key={goal.id} goal={goal} onEdit={() => setSheet({ kind: 'goal', goal })}
        onEntry={(withdrawal) => setSheet({ kind: 'entry', goal, withdrawal })} onChanged={load} />)}</div>
      <p className="muted small">Пополнения не считаются расходами: это по-прежнему ваши деньги.</p>
    </>}
    {sheet?.kind === 'goal' && <GoalSheet goal={sheet.goal} onClose={() => setSheet(null)} onSaved={load} />}
    {sheet?.kind === 'entry' && <EntrySheet goal={sheet.goal} withdrawal={sheet.withdrawal} onClose={() => setSheet(null)} onSaved={load} />}
  </>;
}

function monthYear(iso: string) {
  const date = parseIso(iso);
  return `${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}`;
}

function GoalCard({ goal, onEdit, onEntry, onChanged }: { goal: SavingsGoal; onEdit: () => void; onEntry: (withdrawal: boolean) => void; onChanged: () => Promise<void> }) {
  const { fail, toast } = useFinance();
  const done = goal.progressPercent >= 100;
  return <section className="panel item" style={{ '--goal': goal.color } as React.CSSProperties}>
    <div className="item-h">
      <div><h3><i className="dot goal-dot" />{goal.name}{done && <span className="pill ok">цель достигнута</span>}</h3>
        <p>{[goal.note, goal.targetDate ? `к ${dateShort(goal.targetDate)}` : ''].filter(Boolean).join(' · ') || 'Без срока'}</p></div>
      <button type="button" className="iconbtn" onClick={onEdit} aria-label={`Изменить цель ${goal.name}`}><Icon name="edit" /></button>
    </div>
    <div className="goal-amount"><span className="num">{money(goal.savedAmount)}</span> <span className="muted">из {money(goal.targetAmount)}</span></div>
    <div className="track goal-track"><i style={{ width: `${Math.min(100, goal.progressPercent)}%` }} /></div>
    <div className="kv">
      <div><span>{goal.targetDate ? 'Нужно в месяц' : 'Средний темп'}</span>
        <b className="num">{goal.targetDate ? (goal.remainingAmount > 0 ? moneyRounded(goal.recommendedMonthly) : '—') : goal.averageMonthly > 0 ? `${moneyRounded(goal.averageMonthly)}/мес` : '—'}</b></div>
      <div><span>Прогноз</span><b className="num">{done ? 'готово' : goal.projectedDate ? `к ${monthYear(goal.projectedDate)}` : 'нужны пополнения'}</b></div>
    </div>
    <div className="row-actions">
      <button type="button" className="btn primary" onClick={() => onEntry(false)}><Icon name="plus" />Пополнить</button>
      {goal.savedAmount > 0 && <button type="button" className="btn" onClick={() => onEntry(true)}>Снять</button>}
    </div>
    {goal.entries.length > 0 && <details className="hist">
      <summary><span>История · {goal.entries.length}</span><Icon name="right" /></summary>
      {goal.entries.map((entry) => <p key={entry.id}>
        <span>{dateShort(entry.entryDate)}{entry.comment ? ` · ${entry.comment}` : ''}</span>
        <span className="hist-right"><b className={`num ${entry.amount >= 0 ? 'pos' : ''}`}>{money(entry.amount, true)}</b>
          <ConfirmButton className="mini" label={<Icon name="trash" />} confirmLabel="Удалить?"
            onConfirm={() => api.deleteEntry(goal.id, entry.id).then(() => { toast('Запись удалена'); return onChanged(); }).catch(fail)} /></span>
      </p>)}
    </details>}
  </section>;
}

function GoalSheet({ goal, onClose, onSaved }: { goal?: SavingsGoal; onClose: () => void; onSaved: () => Promise<void> }) {
  const { toast } = useFinance();
  const [name, setName] = useState(goal?.name ?? '');
  const [amount, setAmount] = useState(goal ? String(goal.targetAmount).replace('.', ',') : '');
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');
  const [note, setNote] = useState(goal?.note ?? '');
  const [color, setColor] = useState(goal && GOAL_COLORS.includes(goal.color.toUpperCase()) ? goal.color.toUpperCase() : GOAL_COLORS[goal ? 0 : 0]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const targetAmount = parseAmount(amount);
    if (!name.trim()) { setError('Введите название'); return; }
    if (!(targetAmount > 0)) { setError('Введите сумму больше нуля'); return; }
    setBusy(true);
    try {
      const payload = { name: name.trim(), targetAmount, targetDate: targetDate || null, createdDate: goal?.createdDate ?? todayIso(), note: note.trim(), color };
      if (goal) await api.updateGoal(goal.id, payload); else await api.createGoal(payload);
      toast(goal ? 'Цель сохранена' : 'Цель создана');
      onClose();
      await onSaved();
    } catch (requestError) { setError(errorText(requestError)); setBusy(false); }
  }

  async function remove() {
    if (!goal) return;
    setBusy(true);
    try {
      await api.deleteGoal(goal.id);
      toast('Цель удалена');
      onClose();
      await onSaved();
    } catch (requestError) { setError(errorText(requestError)); setBusy(false); }
  }

  return <Sheet title={goal ? 'Цель' : 'Новая цель'} onClose={onClose} onSubmit={() => void save()}>
    <Field label="Название"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, финансовая подушка" maxLength={255} data-autofocus /></Field>
    <div className="field"><span>Сколько нужно</span><AmountInput value={amount} onChange={setAmount} label="Сумма цели" autoFocus={false} /></div>
    <div className="two">
      <Field label="К какой дате"><input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></Field>
      <div className="field"><span>Цвет</span><div className="swatches">{GOAL_COLORS.map((value) =>
        <button type="button" key={value} className="swatch" style={{ background: value }} aria-pressed={color === value} onClick={() => setColor(value)} aria-label={`Цвет ${value}`} />)}</div></div>
    </div>
    <Field label="Комментарий"><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Зачем эта цель" maxLength={1000} /></Field>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="actions">
      {goal && <ConfirmButton label={<><Icon name="trash" />Удалить</>} confirmLabel="Удалить вместе с историей?" onConfirm={remove} disabled={busy} />}
      <button type="submit" className="btn primary" disabled={busy}>{goal ? 'Сохранить' : 'Создать цель'}</button>
    </div>
  </Sheet>;
}

function EntrySheet({ goal, withdrawal, onClose, onSaved }: { goal: SavingsGoal; withdrawal: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const { toast } = useFinance();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const value = parseAmount(amount);
    if (!(value > 0)) { setError('Введите сумму больше нуля'); return; }
    if (withdrawal && value > goal.savedAmount) { setError(`В цели ${money(goal.savedAmount)}, больше снять нельзя`); return; }
    setBusy(true);
    try {
      await api.addEntry(goal.id, { amount: value, entryDate: date, comment: comment.trim(), withdrawal });
      toast(withdrawal ? `Снято ${money(value)}` : `Отложено ${money(value)}`);
      onClose();
      await onSaved();
    } catch (requestError) { setError(errorText(requestError)); setBusy(false); }
  }

  return <Sheet title={`${withdrawal ? 'Снять' : 'Пополнить'} · ${goal.name}`} onClose={onClose} onSubmit={() => void save()}>
    <AmountInput value={amount} onChange={setAmount} label="Сумма" />
    <Field label="Дата"><input type="date" value={date} max={todayIso()} onChange={(event) => setDate(event.target.value)} required /></Field>
    <Field label="Комментарий"><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Необязательно" /></Field>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="actions"><button type="submit" className="btn primary" disabled={busy}>{withdrawal ? 'Снять из цели' : 'Добавить в цель'}</button></div>
  </Sheet>;
}
