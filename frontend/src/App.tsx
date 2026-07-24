import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Label, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  createCategory, createDebt, createTransaction, deleteDebt, deleteTransaction, exportVehicle, getCategories,
  getDebts, getSummary, getTransactions, getVehicleSummary, getVehicles, importBackup, exportBackup,
  payDebt, updateDebt, updateTransaction,
} from './api';
import type { Category, Debt, Summary, Transaction, TransactionType, Vehicle, VehicleSummary } from './types';

type View = 'overview' | 'vehicles' | 'debts' | 'categories';
const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const shortMonths = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const colors = ['#6c5ce7', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#e84393', '#00cec9', '#a29bfe'];
const emptyForm = {
  type: 'EXPENSE' as TransactionType, category: '', amount: '',
  transactionDate: new Date().toISOString().slice(0, 10), description: '', vehicleId: null as number | null,
};
const emptyDebtForm = { name: '', initialAmount: '', createdDate: new Date().toISOString().slice(0, 10), note: '' };
const emptyPaymentForm = { amount: '', paymentDate: new Date().toISOString().slice(0, 10), comment: '' };

export default function App() {
  const [view, setView] = useState<View>('overview');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleSummary, setVehicleSummary] = useState<VehicleSummary | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtForm, setDebtForm] = useState(emptyDebtForm);
  const [editingDebtId, setEditingDebtId] = useState<number | null>(null);
  const [payingDebtId, setPayingDebtId] = useState<number | null>(null);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<TransactionType>('EXPENSE');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('finance-theme') === 'dark' ? 'dark' : 'light');
  const referenceDataLoaded = useRef(false);
  const backupInput = useRef<HTMLInputElement>(null);

  const availableCategories = categories.filter((category) => category.type === form.type);
  const vehicleTransactions = useMemo(() => transactions.filter((item) => item.category === 'Машина'), [transactions]);
  const vehicleTotal = vehicleTransactions.reduce((total, item) => total + item.amount, 0);
  const fuelTotal = vehicleTransactions.filter((item) => /бенз|азс|топлив/i.test(item.description)).reduce((total, item) => total + item.amount, 0);

  async function loadData() {
    setLoading(true);
    try {
      const [items, totals, categoryItems, vehicleItems] = await Promise.all([
        getTransactions(year, month),
        getSummary(year, month),
        referenceDataLoaded.current ? Promise.resolve(categories) : getCategories(),
        referenceDataLoaded.current ? Promise.resolve(vehicles) : getVehicles(),
      ]);
      referenceDataLoaded.current = true;
      setTransactions(items);
      setSummary(totals);
      setCategories(categoryItems);
      setVehicles(vehicleItems);
      setVehicleSummary(vehicleItems[0] ? await getVehicleSummary(vehicleItems[0].id, year) : null);
      setForm((current) => ({
        ...current,
        category: categoryItems.some((item) => item.type === current.type && item.name === current.category)
          ? current.category : categoryItems.find((item) => item.type === current.type)?.name ?? '',
        vehicleId: current.vehicleId ?? vehicleItems[0]?.id ?? null,
      }));
      setError('');
    } catch (requestError) {
      setError(message(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, [year, month]);
  useEffect(() => {
    if (view !== 'debts') return;
    getDebts().then(setDebts).catch((requestError) => setError(message(requestError)));
  }, [view]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('finance-theme', theme);
  }, [theme]);
  useEffect(() => {
    if (!editingId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelEdit();
    };
    document.addEventListener('keydown', closeOnEscape);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.classList.remove('modal-open');
    };
  }, [editingId]);

  function openView(nextView: View, selectedMonth: number | null = month) {
    setView(nextView);
    setMonth(selectedMonth);
    cancelEdit();
  }

  function changeType(type: TransactionType) {
    setForm((current) => ({
      ...current, type,
      category: categories.find((category) => category.type === type)?.name ?? '',
    }));
  }

  async function saveOperation(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      type: form.type, category: form.category, amount: Number(form.amount),
      transactionDate: form.transactionDate, description: form.description,
      vehicleId: form.category === 'Машина' ? form.vehicleId : null,
    };
    try {
      if (editingId) await updateTransaction(editingId, payload);
      else await createTransaction(payload);
      cancelEdit();
      await loadData();
    } catch (requestError) {
      setError(message(requestError));
    }
  }

  async function restoreBackup(file?: File) {
    if (!file) return;
    if (backupInput.current) backupInput.current.value = '';
    if (!window.confirm('Импорт заменит все текущие финансовые данные содержимым файла. Продолжить?')) return;
    try {
      await importBackup(file);
      referenceDataLoaded.current = false;
      await loadData();
      setError('');
      window.alert('Резервная копия успешно восстановлена.');
    } catch (requestError) {
      setError(message(requestError));
    }
  }

  function editOperation(item: Transaction) {
    setEditingId(item.id);
    setForm({
      type: item.type, category: item.category, amount: String(item.amount),
      transactionDate: item.transactionDate, description: item.description, vehicleId: item.vehicleId,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm((current) => ({ ...emptyForm, category: categories.find((item) => item.type === 'EXPENSE')?.name ?? '', vehicleId: current.vehicleId ?? vehicles[0]?.id ?? null }));
  }

  async function removeOperation(item: Transaction) {
    if (!window.confirm(`Удалить операцию «${item.category}» на ${formatMoney(item.amount)}?`)) return;
    try {
      await deleteTransaction(item.id);
      if (editingId === item.id) cancelEdit();
      await loadData();
    } catch (requestError) {
      setError(message(requestError));
    }
  }

  async function addCategory(event: React.FormEvent) {
    event.preventDefault();
    try {
      const created = await createCategory({ name: categoryName.trim(), type: categoryType });
      setCategories((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name, 'ru')));
      setCategoryName('');
    } catch (requestError) { setError(message(requestError)); }
  }

  async function saveDebt(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      name: debtForm.name.trim(),
      initialAmount: Number(debtForm.initialAmount),
      createdDate: debtForm.createdDate,
      note: debtForm.note.trim(),
    };
    try {
      if (editingDebtId) await updateDebt(editingDebtId, payload);
      else await createDebt(payload);
      setDebts(await getDebts());
      setEditingDebtId(null);
      setDebtForm(emptyDebtForm);
    } catch (requestError) { setError(message(requestError)); }
  }

  function startDebtEdit(debt: Debt) {
    setEditingDebtId(debt.id);
    setDebtForm({
      name: debt.name,
      initialAmount: String(debt.initialAmount),
      createdDate: debt.createdDate,
      note: debt.note,
    });
  }

  async function removeDebt(debt: Debt) {
    if (!window.confirm(`Удалить долг «${debt.name}»? Операции погашения останутся в общем списке.`)) return;
    try {
      await deleteDebt(debt.id);
      setDebts(await getDebts());
    } catch (requestError) { setError(message(requestError)); }
  }

  async function submitDebtPayment(event: React.FormEvent, debt: Debt) {
    event.preventDefault();
    try {
      await payDebt(debt.id, {
        amount: Number(paymentForm.amount),
        paymentDate: paymentForm.paymentDate,
        comment: paymentForm.comment.trim(),
      });
      setPayingDebtId(null);
      setPaymentForm(emptyPaymentForm);
      setDebts(await getDebts());
      await loadData();
    } catch (requestError) { setError(message(requestError)); }
  }

  const chartData = (summary?.monthlyPoints ?? []).map((point, index) => ({ ...point, monthLabel: month ? months[month - 1] : shortMonths[index] }));
  const yearOptions = Array.from({ length: new Date().getFullYear() + 5 - 2026 + 1 }, (_, index) => 2026 + index);
  const visibleMonths = months.map((name, index) => ({ name, number: index + 1 }))
    .filter((item) => year > 2026 || item.number >= 7);

  function changeYear(nextYear: number) {
    setYear(nextYear);
    if (nextYear === 2026 && month !== null && month < 7) setMonth(null);
  }

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span>₽</span><strong>Мои финансы</strong></div>
      <div className="sidebar-controls">
        <label>Финансовый год<select value={year} onChange={(event) => changeYear(Number(event.target.value))}>{yearOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
        <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          <span>{theme === 'light' ? '☾' : '☀'}</span>{theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
        </button>
      </div>
      <nav>
        <button className={view === 'overview' && month === null ? 'active' : ''} onClick={() => openView('overview', null)}>Главная</button>
        <button className={view === 'vehicles' ? 'active' : ''} onClick={() => openView('vehicles', null)}>Автомобиль</button>
        <button className={view === 'debts' ? 'active' : ''} onClick={() => openView('debts', null)}>Долги</button>
        <button className={view === 'categories' ? 'active' : ''} onClick={() => openView('categories')}>Категории</button>
        <p>Месяцы</p>
        {visibleMonths.map((item) => <button key={item.name} className={view === 'overview' && month === item.number ? 'active' : ''} onClick={() => openView('overview', item.number)}>{item.name}</button>)}
      </nav>
    </aside>

    <main>
      <header className="topbar">
        <div><p className="kicker">{subtitle(view, month)}</p><h1>{title(view, month, year)}</h1></div>
        {view === 'overview' && month === null && <div className="backup-actions">
          <button type="button" onClick={() => exportBackup().catch((requestError) => setError(message(requestError)))}>
            <span>↓</span> Экспорт
          </button>
          <button type="button" onClick={() => backupInput.current?.click()}>
            <span>↑</span> Импорт
          </button>
          <input ref={backupInput} type="file" accept=".json,application/json" hidden
            onChange={(event) => void restoreBackup(event.target.files?.[0])} />
        </div>}
      </header>
      {error && <div className="error">{error}<button onClick={() => setError('')}>×</button></div>}

      {view === 'overview' && <>
        <section className="metrics">
          <Metric title="Доход" value={summary?.income} kind="income" />
          <Metric title="Расход" value={summary?.expense} kind="expense" />
          <Metric title="Сальдо" value={summary?.balance} kind="balance" />
          <Metric title="Операций" value={transactions.length} plain />
          {month && <Metric title="В среднем за сутки" value={summary?.averageDailyExpense} kind="daily" />}
          {month && <Metric title="Еда в среднем за сутки" value={summary?.averageDailyFoodExpense} kind="food" />}
        </section>
        <section className="content-grid">
          <div className="dashboard-stack">
            <article className="card chart-card"><CardTitle title={month ? 'Доходы и расходы' : 'Динамика по месяцам'} subtitle={month ? months[month - 1] : `${year} год`} />
              <ResponsiveContainer width="100%" height={320}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#3b394d' : '#e9e8f0'} /><XAxis dataKey="monthLabel" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} tickFormatter={compactMoney} /><Tooltip formatter={(value, name) => [formatMoney(Number(value)), name]} contentStyle={tooltipStyle(theme)} /><Legend /><Bar dataKey="income" name="Доход" fill="#00b894" radius={[5, 5, 0, 0]} /><Bar dataKey="expense" name="Расход" fill="#6c5ce7" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>
            </article>
            <article className="card operation-editor dashboard-operation">
              <CardTitle title="Добавить операцию" subtitle="Доход или расход" />
              <OperationForm form={form} setForm={setForm} categories={availableCategories} vehicles={vehicles} editing={false} onType={changeType} onSubmit={saveOperation} onCancel={cancelEdit} />
            </article>
          </div>
          <article className="card category-chart-card"><CardTitle title="Расходы по категориям" subtitle={month ? months[month - 1] : `${year} год`} />
            <ResponsiveContainer width="100%" height={270}><PieChart><Pie data={summary?.categoryPoints ?? []} dataKey="amount" nameKey="category" innerRadius={72} outerRadius={108} paddingAngle={1} cornerRadius={4} stroke="none">{(summary?.categoryPoints ?? []).map((entry, index) => <Cell key={entry.category} fill={colors[index % colors.length]} />)}<Label value="Расходы" position="center" dy={-12} className="donut-caption" /><Label value={compactMoney(summary?.expense ?? 0)} position="center" dy={13} className="donut-total" /></Pie><Tooltip formatter={(value, _name, item) => [`${formatMoney(Number(value))} · ${summary?.expense ? ((Number(value) / summary.expense) * 100).toFixed(1) : '0'}%`, item.payload?.category ?? 'Категория']} contentStyle={tooltipStyle(theme)} /></PieChart></ResponsiveContainer>
            <div className="legend-list full-legend">{(summary?.categoryPoints ?? []).map((point, index) => <div key={point.category}><i style={{ background: colors[index % colors.length] }} /><span>{point.category}</span><strong>{summary?.expense ? ((point.amount / summary.expense) * 100).toFixed(1) : '0'}%</strong><small>{formatMoney(point.amount)}</small></div>)}</div>
          </article>
        </section>
        <TransactionTable items={transactions} loading={loading} onEdit={editOperation} onDelete={removeOperation} />
      </>}

      {view === 'vehicles' && <>
        <div className="section-actions"><button className="primary export-button" onClick={() => vehicles[0] && exportVehicle(vehicles[0].id, year).catch((requestError) => setError(message(requestError)))}>Скачать Excel за {year} год</button></div>
        <section className="metrics vehicle-metrics">
          <Metric title="Всего на автомобиль" value={vehicleSummary?.total ?? vehicleTotal} kind="expense" />
          <Metric title="Топливо" value={vehicleSummary?.fuel ?? fuelTotal} kind="balance" />
          <Metric title="Бензин в среднем за месяц" value={vehicleSummary?.averageMonthlyFuel} kind="income" />
          <Metric title="Обслуживание и прочее" value={vehicleSummary?.other ?? vehicleTotal - fuelTotal} />
          <Metric title="Операций" value={vehicleSummary?.operationCount ?? vehicleTransactions.length} plain />
        </section>
        <section className="content-grid lower">
          <article className="card"><CardTitle title="Мой автомобиль" subtitle="Lada Vesta" />
            <div className="vehicle-list">{vehicles.map((vehicle) => <div key={vehicle.id}><span>🚙</span><div><strong>{vehicle.name}</strong><small>{formatMoney(vehicleTransactions.filter((item) => item.vehicleId === vehicle.id).reduce((sum, item) => sum + item.amount, 0))} за {year} год</small></div></div>)}</div>
          </article>
          <article className="card"><CardTitle title="Расходы на автомобиль" subtitle={`${year} год · ${vehicleSummary?.activeMonths ?? 0} мес. с расходами`} /><div className="car-breakdown"><div><span>Топливо</span><strong>{formatMoney(vehicleSummary?.fuel ?? fuelTotal)}</strong></div><div><span>Среднее топливо в месяц</span><strong>{formatMoney(vehicleSummary?.averageMonthlyFuel ?? 0)}</strong></div><div><span>Остальные расходы</span><strong>{formatMoney(vehicleSummary?.other ?? vehicleTotal - fuelTotal)}</strong></div></div></article>
        </section>
        <TransactionTable items={vehicleTransactions} loading={loading} onEdit={editOperation} onDelete={removeOperation} />
      </>}

      {view === 'debts' && <DebtView
        debts={debts}
        form={debtForm}
        setForm={setDebtForm}
        editingId={editingDebtId}
        payingId={payingDebtId}
        paymentForm={paymentForm}
        setPaymentForm={setPaymentForm}
        onSave={saveDebt}
        onEdit={startDebtEdit}
        onCancelEdit={() => { setEditingDebtId(null); setDebtForm(emptyDebtForm); }}
        onDelete={removeDebt}
        onStartPayment={(debt: Debt) => {
          setPayingDebtId(debt.id);
          setPaymentForm({ ...emptyPaymentForm, amount: String(debt.remainingAmount) });
        }}
        onCancelPayment={() => { setPayingDebtId(null); setPaymentForm(emptyPaymentForm); }}
        onPayment={submitDebtPayment}
      />}

      {view === 'categories' && <article className="card settings-card">
        <CardTitle title="Категории операций" subtitle="Используются во всех годах" />
        <div className="category-groups"><CategoryGroup title="Расходы" items={categories.filter((item) => item.type === 'EXPENSE')} /><CategoryGroup title="Доходы" items={categories.filter((item) => item.type === 'INCOME')} /></div>
        <form className="category-form" onSubmit={addCategory}><input required value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Название новой категории" /><select value={categoryType} onChange={(event) => setCategoryType(event.target.value as TransactionType)}><option value="EXPENSE">Расход</option><option value="INCOME">Доход</option></select><button className="primary">Добавить</button></form>
      </article>}
    </main>
    {editingId && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) cancelEdit();
    }}>
      <section className="card operation-modal" role="dialog" aria-modal="true" aria-labelledby="edit-operation-title">
        <button type="button" className="modal-close" onClick={cancelEdit} aria-label="Закрыть">×</button>
        <div className="card-title"><div><h2 id="edit-operation-title">Редактировать операцию</h2><p>Операция №{editingId}</p></div></div>
        <OperationForm form={form} setForm={setForm} categories={availableCategories} vehicles={vehicles} editing onType={changeType} onSubmit={saveOperation} onCancel={cancelEdit} />
      </section>
    </div>}
  </div>;
}

function OperationForm({ form, setForm, categories, vehicles, editing, onType, onSubmit, onCancel }: any) {
  return <form className="transaction-form" onSubmit={onSubmit}>
    <div className="segmented"><button type="button" className={form.type === 'EXPENSE' ? 'selected' : ''} onClick={() => onType('EXPENSE')}>Расход</button><button type="button" className={form.type === 'INCOME' ? 'selected' : ''} onClick={() => onType('INCOME')}>Доход</button></div>
    <label>Категория<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category: Category) => <option key={category.id}>{category.name}</option>)}</select></label>
    <label>Сумма<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0 ₽" /></label>
    {form.category === 'Машина' && <label>Автомобиль<select required value={form.vehicleId ?? ''} onChange={(event) => setForm({ ...form, vehicleId: Number(event.target.value) })}>{vehicles.map((vehicle: Vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></label>}
    <label>Дата<input required type="date" value={form.transactionDate} onChange={(event) => setForm({ ...form, transactionDate: event.target.value })} /></label>
    <label className="comment-field">Комментарий<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Необязательно" /></label>
    <div className="form-actions"><button className="primary">{editing ? 'Сохранить изменения' : 'Сохранить операцию'}</button>{editing && <button type="button" className="secondary" onClick={onCancel}>Отмена</button>}</div>
  </form>;
}

function TransactionTable({ items, loading, onEdit, onDelete }: { items: Transaction[]; loading: boolean; onEdit: (item: Transaction) => void; onDelete: (item: Transaction) => void }) {
  const [category, setCategory] = useState('');
  const categoryOptions = useMemo(() => [...new Set(items.map((item) => item.category))].sort((a, b) => a.localeCompare(b, 'ru')), [items]);
  const filteredItems = category ? items.filter((item) => item.category === category) : items;

  useEffect(() => {
    if (category && !categoryOptions.includes(category)) setCategory('');
  }, [category, categoryOptions]);

  const subtitle = loading
    ? 'Загрузка…'
    : category ? `${filteredItems.length} из ${items.length} записей` : `${items.length} записей`;

  return <section className="card transactions">
    <div className="transactions-head">
      <CardTitle title="Операции" subtitle={subtitle} />
      <label className="category-filter">
        <span>Категория</span>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Все категории</option>
          {categoryOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
    </div>
    <div className="table-wrap"><table><thead><tr><th>Дата</th><th>Категория</th><th>Комментарий</th><th>Сумма</th><th /></tr></thead><tbody>{filteredItems.map((item) => <tr key={item.id}><td>{formatDate(item.transactionDate)}</td><td><b>{item.category}</b></td><td>{item.description || '—'}</td><td className={item.type === 'INCOME' ? 'money-in' : 'money-out'}>{item.type === 'INCOME' ? '+' : '−'} {formatMoney(item.amount)}</td><td className="row-actions"><button onClick={() => onEdit(item)} title="Редактировать">✎</button><button className="delete" onClick={() => onDelete(item)} title="Удалить">×</button></td></tr>)}</tbody></table></div>
  </section>;
}

function CategoryGroup({ title, items }: { title: string; items: Category[] }) { return <div><h3>{title}</h3><div className="category-pills">{items.map((item) => <span key={item.id} className={item.type === 'INCOME' ? 'income-pill' : ''}>{item.name}</span>)}</div></div>; }

function DebtView({ debts, form, setForm, editingId, payingId, paymentForm, setPaymentForm, onSave, onEdit, onCancelEdit, onDelete, onStartPayment, onCancelPayment, onPayment }: any) {
  const total = debts.reduce((sum: number, debt: Debt) => sum + debt.initialAmount, 0);
  const paid = debts.reduce((sum: number, debt: Debt) => sum + debt.paidAmount, 0);
  const remaining = debts.reduce((sum: number, debt: Debt) => sum + debt.remainingAmount, 0);

  return <>
    <section className="metrics debt-metrics">
      <Metric title="Общая сумма долгов" value={total} kind="expense" />
      <Metric title="Уже погашено" value={paid} kind="income" />
      <Metric title="Осталось погасить" value={remaining} kind="balance" />
      <Metric title="Активных долгов" value={debts.filter((debt: Debt) => debt.remainingAmount > 0).length} plain />
    </section>

    <section className="debt-layout">
      <article className="card debt-editor">
        <CardTitle title={editingId ? 'Редактировать долг' : 'Добавить долг'} subtitle="Сумма обязательства и описание" />
        <form className="debt-form" onSubmit={onSave}>
          <label>Название<input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Например, кредитная карта" /></label>
          <div className="debt-form-row">
            <label>Начальная сумма<input required type="number" min="0.01" step="0.01" value={form.initialAmount} onChange={(event) => setForm({ ...form, initialAmount: event.target.value })} placeholder="0 ₽" /></label>
            <label>Дата<input required type="date" value={form.createdDate} onChange={(event) => setForm({ ...form, createdDate: event.target.value })} /></label>
          </div>
          <label>Комментарий<input maxLength={1000} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Необязательно" /></label>
          <div className="form-actions"><button className="primary">{editingId ? 'Сохранить' : 'Добавить долг'}</button>{editingId && <button type="button" className="secondary" onClick={onCancelEdit}>Отмена</button>}</div>
        </form>
      </article>

      <div className="debt-list">
        {debts.length === 0 && <article className="card debt-empty"><span>✓</span><h2>Долгов пока нет</h2><p>Добавьте обязательство слева, чтобы отслеживать остаток и погашения.</p></article>}
        {debts.map((debt: Debt) => <article className={`card debt-card ${debt.remainingAmount === 0 ? 'closed' : ''}`} key={debt.id}>
          <div className="debt-card-head">
            <div><span className="debt-status">{debt.remainingAmount === 0 ? 'Погашен' : 'Активный долг'}</span><h2>{debt.name}</h2><p>{debt.note || `Создан ${formatDate(debt.createdDate)}`}</p></div>
            <div className="debt-actions"><button onClick={() => onEdit(debt)} title="Редактировать">✎</button><button className="delete" onClick={() => onDelete(debt)} title="Удалить">×</button></div>
          </div>
          <div className="debt-values"><div><span>Осталось</span><strong>{formatMoney(debt.remainingAmount)}</strong></div><div><span>Погашено</span><b>{formatMoney(debt.paidAmount)} из {formatMoney(debt.initialAmount)}</b></div></div>
          <div className="debt-progress"><i style={{ width: `${debt.progressPercent}%` }} /></div>
          <div className="debt-progress-label"><span>{debt.progressPercent}%</span><span>{debt.remainingAmount === 0 ? 'Готово' : 'до полного погашения'}</span></div>

          {debt.remainingAmount > 0 && payingId !== debt.id && <button className="primary debt-pay-button" onClick={() => onStartPayment(debt)}>Погасить часть долга</button>}
          {payingId === debt.id && <form className="payment-form" onSubmit={(event) => onPayment(event, debt)}>
            <label>Сумма<input autoFocus required type="number" min="0.01" max={debt.remainingAmount} step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} /></label>
            <label>Дата<input required type="date" value={paymentForm.paymentDate} onChange={(event) => setPaymentForm({ ...paymentForm, paymentDate: event.target.value })} /></label>
            <label className="payment-comment">Комментарий<input value={paymentForm.comment} onChange={(event) => setPaymentForm({ ...paymentForm, comment: event.target.value })} placeholder="Необязательно" /></label>
            <div className="form-actions"><button className="primary">Записать погашение</button><button type="button" className="secondary" onClick={onCancelPayment}>Отмена</button></div>
          </form>}

          {debt.payments.length > 0 && <details className="payment-history"><summary>История погашений · {debt.payments.length}</summary><div>{debt.payments.map((payment) => <p key={payment.id}><span>{formatDate(payment.paymentDate)}</span><b>{formatMoney(payment.amount)}</b></p>)}</div></details>}
        </article>)}
      </div>
    </section>
  </>;
}

function Metric({ title, value, kind, plain }: { title: string; value?: number; kind?: string; plain?: boolean }) { return <article className={`metric ${kind ?? ''}`}><span>{title}</span><strong>{plain ? value ?? 0 : formatMoney(value ?? 0)}</strong></article>; }
function CardTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div className="card-title"><div><h2>{title}</h2><p>{subtitle}</p></div></div>; }
function title(view: View, month: number | null, year: number) { if (view === 'vehicles') return 'Автомобиль'; if (view === 'debts') return 'Долги'; if (view === 'categories') return 'Категории'; return month ? months[month - 1] : `Весь ${year} год`; }
function subtitle(view: View, month: number | null) { if (view === 'vehicles') return 'Расходы на транспорт'; if (view === 'debts') return 'Контроль обязательств'; if (view === 'categories') return 'Настройки справочника'; return month ? 'Отчёт за месяц' : 'Финансовый обзор'; }
function formatMoney(value: number) { return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(value); }
function compactMoney(value: number) { return new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value); }
function formatDate(value: string) { return new Intl.DateTimeFormat('ru-RU').format(new Date(`${value}T00:00:00`)); }
function message(error: unknown) { return error instanceof Error ? error.message : 'Произошла ошибка'; }
function tooltipStyle(theme: 'light' | 'dark') {
  return {
    background: theme === 'dark' ? '#302e43' : '#ffffff',
    border: `1px solid ${theme === 'dark' ? '#49465d' : '#e5e2ec'}`,
    borderRadius: '10px',
    color: theme === 'dark' ? '#f6f4ff' : '#242334',
  };
}
