import { useRef, useState } from 'react';
import { api } from '../api';
import { CAR, categoryColor, DEBTS, FOOD } from '../categories';
import { Icon } from '../components/Icon';
import { ConfirmButton, PageHead } from '../components/ui';
import { moneyRounded, parseAmount } from '../format';
import { errorText, useFinance } from '../store';
import type { Category, TransactionType } from '../types';

const SYSTEM = [FOOD, CAR, DEBTS];

export function Settings() {
  return <>
    <PageHead kicker="Финансы" title="Настройки" />
    <div className="grid2">
      <CategoryPanel type="EXPENSE" title="Категории расходов" />
      <div className="col">
        <CategoryPanel type="INCOME" title="Категории доходов" />
        <LimitsPanel />
        <BackupPanel />
      </div>
    </div>
  </>;
}

function CategoryPanel({ type, title }: { type: TransactionType; title: string }) {
  const { categories, reloadReferences, reload, toast } = useFinance();
  const items = categories.filter((item) => item.type === type);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function add() {
    if (!name.trim()) return;
    try {
      await api.createCategory(name.trim(), type);
      toast(`Категория «${name.trim()}» добавлена`);
      setName('');
      setAdding(false);
      setError('');
      await reloadReferences();
    } catch (requestError) { setError(errorText(requestError)); }
  }

  return <section className="panel">
    <div className="panel-h"><h2>{title}</h2>
      {!adding && <button type="button" className="btn line" onClick={() => setAdding(true)}><Icon name="plus" />Добавить</button>}</div>
    {adding && <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void add(); }}>
      <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Название категории" maxLength={255} aria-label="Название новой категории" />
      <button type="submit" className="btn primary">Добавить</button>
      <button type="button" className="btn" onClick={() => { setAdding(false); setName(''); setError(''); }}>Отмена</button>
    </form>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="rows">{items.map((item) => <CategoryRow key={item.id} item={item} others={items.filter((other) => other.id !== item.id && !SYSTEM.includes(other.name))}
      onChanged={async () => { await reloadReferences(); await reload(); }} />)}</div>
  </section>;
}

function CategoryRow({ item, others, onChanged }: { item: Category; others: Category[]; onChanged: () => Promise<void> }) {
  const { toast } = useFinance();
  const [mode, setMode] = useState<'view' | 'rename' | 'delete'>('view');
  const [name, setName] = useState(item.name);
  const [moveTo, setMoveTo] = useState('');
  const [error, setError] = useState('');
  const system = item.type === 'EXPENSE' && SYSTEM.includes(item.name);

  async function rename() {
    try {
      await api.renameCategory(item.id, name.trim());
      toast('Категория переименована');
      setMode('view');
      await onChanged();
    } catch (requestError) { setError(errorText(requestError)); }
  }

  async function remove() {
    try {
      await api.deleteCategory(item.id, moveTo || undefined);
      toast(moveTo ? `Категория удалена, операции перенесены в «${moveTo}»` : 'Категория удалена');
      await onChanged();
    } catch (requestError) { setError(errorText(requestError)); }
  }

  return <div className="row-block">
    <div className="row">
      <i className="dot" style={{ background: categoryColor(item.name, item.type) }} />
      {mode === 'rename'
        ? <form className="inline-form grow" onSubmit={(event) => { event.preventDefault(); void rename(); }}>
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={255} aria-label="Новое название" />
          <button type="submit" className="btn primary">Сохранить</button>
          <button type="button" className="btn" onClick={() => { setMode('view'); setName(item.name); setError(''); }}>Отмена</button>
        </form>
        : <span className="grow">{item.name}{system && <span className="muted small"> · отдельный раздел</span>}</span>}
      {mode === 'view' && !system && <span className="icons">
        <button type="button" onClick={() => setMode('rename')} aria-label={`Переименовать ${item.name}`}><Icon name="edit" /></button>
        <button type="button" onClick={() => setMode('delete')} aria-label={`Удалить ${item.name}`}><Icon name="trash" /></button>
      </span>}
    </div>
    {mode === 'delete' && <div className="row-extra">
      <label className="field"><span>Если в категории есть операции, перенести их в</span>
        <select value={moveTo} onChange={(event) => setMoveTo(event.target.value)}>
          <option value="">— не переносить —</option>
          {others.map((other) => <option key={other.id}>{other.name}</option>)}
        </select>
      </label>
      <div className="row-actions">
        <ConfirmButton label={<><Icon name="trash" />Удалить «{item.name}»</>} confirmLabel="Точно удалить?" onConfirm={remove} />
        <button type="button" className="btn" onClick={() => { setMode('view'); setError(''); }}>Отмена</button>
      </div>
    </div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}

function LimitsPanel() {
  const { budgets, categories, reloadReferences, toast, fail } = useFinance();
  const expense = categories.filter((item) => item.type === 'EXPENSE');
  const free = expense.filter((item) => !budgets.some((budget) => budget.category === item.name));
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [error, setError] = useState('');

  async function save(target: string, raw: string) {
    const value = parseAmount(raw);
    if (!target) { setError('Выберите категорию'); return false; }
    if (!(value > 0)) { setError('Введите сумму больше нуля'); return false; }
    try {
      await api.saveBudget(target, value);
      setError('');
      await reloadReferences();
      toast(`Лимит «${target}»: ${moneyRounded(value)} в месяц`);
      return true;
    } catch (requestError) { setError(errorText(requestError)); return false; }
  }

  return <section className="panel">
    <div className="panel-h"><h2>Месячные лимиты</h2></div>
    <div className="rows">
      {budgets.length === 0 && <p className="empty">Лимитов нет. Добавьте, например, на еду, чтобы видеть темп трат на обзоре.</p>}
      {budgets.map((budget) => <div className="row" key={budget.id}>
        <i className="dot" style={{ background: categoryColor(budget.category) }} />
        <span className="grow">{budget.category}</span>
        {editing === budget.id
          ? <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void save(budget.category, editAmount).then((ok) => ok && setEditing(null)); }}>
            <input autoFocus className="num short" value={editAmount} onChange={(event) => setEditAmount(event.target.value)} inputMode="decimal" aria-label="Новый лимит" />
            <button type="submit" className="btn primary">OK</button>
          </form>
          : <button type="button" className="link num" onClick={() => { setEditing(budget.id); setEditAmount(String(budget.monthlyLimit)); }}>{moneyRounded(budget.monthlyLimit)}</button>}
        <span className="icons"><ConfirmButton className="mini" label={<Icon name="trash" />} confirmLabel="Убрать?"
          onConfirm={() => api.deleteBudget(budget.id).then(reloadReferences).then(() => toast('Лимит убран')).catch(fail)} /></span>
      </div>)}
    </div>
    {free.length > 0 && <form className="inline-form wrap-form" onSubmit={(event) => { event.preventDefault(); void save(category, amount).then((ok) => { if (ok) { setAmount(''); setCategory(''); } }); }}>
      <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Категория для лимита">
        <option value="">Категория…</option>
        {free.map((item) => <option key={item.id}>{item.name}</option>)}
      </select>
      <input className="num short" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="Сумма, ₽" aria-label="Сумма лимита" />
      <button type="submit" className="btn line"><Icon name="plus" />Лимит</button>
    </form>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}

function BackupPanel() {
  const { reload, reloadReferences, toast, fail } = useFinance();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  async function restore() {
    if (!file) return;
    try {
      await api.importBackup(file);
      setFile(null);
      await reloadReferences();
      await reload();
      toast('Резервная копия восстановлена');
    } catch (error) { fail(error); }
  }

  return <section className="panel">
    <div className="panel-h"><h2>Резервная копия</h2></div>
    <p className="muted small">Все операции, долги, цели и лимиты в одном файле JSON.</p>
    <div className="row-actions">
      <button type="button" className="btn line" onClick={() => api.exportBackup().catch(fail)}><Icon name="download" />Скачать копию</button>
      <button type="button" className="btn line" onClick={() => input.current?.click()}><Icon name="upload" />Восстановить из файла</button>
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={(event) => { setFile(event.target.files?.[0] ?? null); event.target.value = ''; }} />
    </div>
    {file && <div className="note warn"><Icon name="info" /><div>
      <p>Файл «{file.name}» заменит <b>все</b> текущие данные. Перед этим лучше скачать свежую копию.</p>
      <div className="row-actions">
        <ConfirmButton label="Заменить данные" confirmLabel="Точно заменить всё?" onConfirm={restore} />
        <button type="button" className="btn" onClick={() => setFile(null)}>Отмена</button>
      </div>
    </div></div>}
  </section>;
}
