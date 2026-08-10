import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Label, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  createCategory, createDebt, createTransaction, deleteDebt, deleteTransaction, exportVehicle, getCategories,
  getDebts, getSummary, getTransactions, getVehicleSummary, getVehicles, importBackup, exportBackup,
  payDebt, updateDebt, updateTransaction,
  addSavingsEntry, createSavingsGoal, deleteSavingsEntry, deleteSavingsGoal, getSavings, updateSavingsGoal,
} from './api';
import type { Category, Debt, SavingsGoal, Summary, Transaction, TransactionType, Vehicle, VehicleExpenseType, VehicleSummary } from './types';

type View = 'overview' | 'transactions' | 'vehicles' | 'debts' | 'savings' | 'categories';
const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const shortMonths = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const colors = ['#6c5ce7', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#e84393', '#00cec9', '#a29bfe'];
const emptyForm = {
  type: 'EXPENSE' as TransactionType, category: '', amount: '',
  transactionDate: new Date().toISOString().slice(0, 10), description: '', vehicleId: null as number | null,
  vehicleExpenseType: 'OTHER' as VehicleExpenseType, odometerKm: '', fuelLiters: '',
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
  const [savings, setSavings] = useState<SavingsGoal[]>([]);
  const [debtForm, setDebtForm] = useState(emptyDebtForm);
  const [editingDebtId, setEditingDebtId] = useState<number | null>(null);
  const [payingDebtId, setPayingDebtId] = useState<number | null>(null);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creatingOperation, setCreatingOperation] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<TransactionType>('EXPENSE');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('finance-theme') === 'dark' ? 'dark' : 'light');
  const referenceDataLoaded = useRef(false);
  const backupInput = useRef<HTMLInputElement>(null);

  const availableCategories = useMemo(() => categories.filter((category) => category.type === form.type), [categories, form.type]);
  const vehicleTransactions = useMemo(() => transactions.filter((item) => item.category === 'Машина'), [transactions]);
  const vehicleTotal = useMemo(() => vehicleTransactions.reduce((total, item) => total + item.amount, 0), [vehicleTransactions]);
  const fuelTotal = useMemo(() => vehicleTransactions.filter((item) => item.vehicleExpenseType === 'FUEL'
    || (!item.vehicleExpenseType && /бенз|азс|топлив/i.test(item.description))).reduce((total, item) => total + item.amount, 0), [vehicleTransactions]);

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
    if (view !== 'savings') return;
    getSavings().then(setSavings).catch((requestError) => setError(message(requestError)));
  }, [view]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('finance-theme', theme);
  }, [theme]);
  useEffect(() => {
    if (!editingId && !creatingOperation) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeOperationModal();
    };
    document.addEventListener('keydown', closeOnEscape);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.classList.remove('modal-open');
    };
  }, [editingId, creatingOperation]);

  function openView(nextView: View, selectedMonth: number | null = month) {
    setView(nextView);
    setMonth(selectedMonth);
    cancelEdit();
  }

  function closeOperationModal() {
    setCreatingOperation(false);
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
      vehicleExpenseType: form.category === 'Машина' ? form.vehicleExpenseType : null,
      odometerKm: form.category === 'Машина' && form.vehicleExpenseType === 'FUEL' && form.odometerKm
        ? Number(form.odometerKm) : null,
      fuelLiters: form.category === 'Машина' && form.vehicleExpenseType === 'FUEL' && form.fuelLiters
        ? Number(form.fuelLiters) : null,
    };
    try {
      if (editingId) {
        await updateTransaction(editingId, payload);
        cancelEdit();
      } else {
        await createTransaction(payload);
        setForm((current) => ({ ...current, amount: '', description: '', odometerKm: '', fuelLiters: '' }));
        setCreatingOperation(false);
      }
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
      vehicleExpenseType: item.vehicleExpenseType ?? 'OTHER', odometerKm: item.odometerKm ? String(item.odometerKm) : '',
      fuelLiters: item.fuelLiters ? String(item.fuelLiters) : '',
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

  const chartData = useMemo(() => (summary?.monthlyPoints ?? []).map((point, index) => ({
    ...point,
    monthLabel: month ? months[month - 1] : shortMonths[index],
  })), [summary?.monthlyPoints, month]);
  const yearOptions = Array.from({ length: new Date().getFullYear() + 5 - 2026 + 1 }, (_, index) => 2026 + index);
  const visibleMonths = months.map((name, index) => ({ name, number: index + 1 }))
    .filter((item) => year > 2026 || item.number >= 7);

  function changeYear(nextYear: number) {
    setYear(nextYear);
    if (nextYear === 2026 && month !== null && month < 7) setMonth(null);
  }

  return <div className="app">
    <aside className="sidebar">
      <a className="home-link" href="https://home.kirzhq.ru" aria-label="Вернуться на главную страницу">
        <span>←</span> Мой дом
      </a>
      <div className="brand"><span>₽</span><strong>Мои финансы</strong><select className="mobile-year-select" value={year} onChange={(event) => changeYear(Number(event.target.value))} aria-label="Финансовый год">{yearOptions.map((value) => <option key={value}>{value}</option>)}</select><button className="theme-icon" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'} title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}>
        {theme === 'light'
          ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.3A8.5 8.5 0 0 1 8.7 4a8.5 8.5 0 1 0 11.3 11.3Z" /></svg>
          : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>}
      </button></div>
      <div className="sidebar-controls">
        <label>Финансовый год<select value={year} onChange={(event) => changeYear(Number(event.target.value))}>{yearOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
      </div>
      <nav>
        <button className={view === 'overview' && month === null ? 'active' : ''} onClick={() => openView('overview', null)}>Главная</button>
        <button className={view === 'transactions' ? 'active' : ''} onClick={() => openView('transactions')}>Операции</button>
        <button className={view === 'vehicles' ? 'active' : ''} onClick={() => openView('vehicles', null)}>Автомобиль</button>
        <button className={view === 'debts' ? 'active' : ''} onClick={() => openView('debts', null)}>Долги</button>
        <button className={view === 'savings' ? 'active' : ''} onClick={() => openView('savings', null)}>Накопления</button>
        <button className={view === 'categories' ? 'active' : ''} onClick={() => openView('categories')}>Категории</button>
      </nav>
    </aside>

    <main>
      <header className="topbar">
        <div><p className="kicker">{subtitle(view, month)}</p><h1>{title(view, month, year)}</h1></div>
        {view === 'overview' && month === null && <div className="backup-actions">
          <button type="button" onClick={() => exportBackup().catch((requestError) => setError(message(requestError)))}>
            <span className="backup-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" /></svg></span>Экспорт
          </button>
          <button type="button" onClick={() => backupInput.current?.click()}>
            <span className="backup-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 16V4m0 0 4 4m-4-4-4 4M5 20h14" /></svg></span>Импорт
          </button>
          <input ref={backupInput} type="file" accept=".json,application/json" hidden
            onChange={(event) => void restoreBackup(event.target.files?.[0])} />
        </div>}
      </header>
      {error && <div className="error">{error}<button onClick={() => setError('')}>×</button></div>}

      {(view === 'overview' || view === 'transactions') && <div className="period-switcher">
        <button className={month === null ? 'active' : ''} onClick={() => setMonth(null)}>Весь год</button>
        {visibleMonths.map((item) => {
          const isCurrent = year === new Date().getFullYear() && item.number === new Date().getMonth() + 1;
          return <button key={item.name} className={`${month === item.number ? 'active' : ''}${isCurrent ? ' current' : ''}`} onClick={() => setMonth(item.number)}>{item.name}</button>;
        })}
      </div>}

      {view === 'overview' && <>
        <section className={`metrics ${month ? 'monthly-metrics' : ''}`}>
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
              <MonthlyChart data={chartData} theme={theme} />
            </article>
            <div className="recent-heading"><div><h2>Последние операции</h2><p>Быстрый обзор последних записей</p></div><button onClick={() => openView('transactions')}>Все операции →</button></div>
            <TransactionTable items={transactions.slice(0, 8)} loading={loading} onEdit={editOperation} onDelete={removeOperation} />
          </div>
          <article className="card category-chart-card"><CardTitle title="Расходы по категориям" subtitle={month ? months[month - 1] : `${year} год`} />
            <CategoryChart points={summary?.categoryPoints ?? []} expense={summary?.expense ?? 0} theme={theme} />
            <div className="legend-list full-legend">{(summary?.categoryPoints ?? []).map((point, index) => <div key={point.category}><i style={{ background: colors[index % colors.length] }} /><span>{point.category}</span><strong>{summary?.expense ? ((point.amount / summary.expense) * 100).toFixed(1) : '0'}%</strong><small>{formatMoney(point.amount)}</small></div>)}</div>
          </article>
        </section>
      </>}

      {view === 'transactions' && <TransactionTable items={transactions} loading={loading} onEdit={editOperation} onDelete={removeOperation} />}

      {view === 'vehicles' && <>
        <div className="section-actions"><button className="primary export-button" onClick={() => vehicles[0] && exportVehicle(vehicles[0].id, year).catch((requestError) => setError(message(requestError)))}>Скачать Excel за {year} год</button></div>
        <section className="metrics vehicle-metrics">
          <Metric title="Всего на автомобиль" value={vehicleSummary?.total ?? vehicleTotal} kind="expense" />
          <Metric title="Бензин" value={vehicleSummary?.fuel ?? fuelTotal} kind="balance" />
          <Metric title="Средние расходы на бензин в месяц" value={vehicleSummary?.averageMonthlyFuel} kind="income" />
          <Metric title="Обслуживание и прочее" value={vehicleSummary?.other ?? vehicleTotal - fuelTotal} />
        </section>
        <section className="vehicle-details">
          <article className="card vehicle-efficiency"><CardTitle title="Пробег и расход" subtitle={`${year} год · данные по заправкам`} />
            <div className="efficiency-summary">
              <div className="efficiency-mileage"><span>Пробег за период</span><strong>{formatNumber(vehicleSummary?.mileageKm ?? 0)} км</strong></div>
              <div className="efficiency-rate"><span>Средний расход</span>{vehicleSummary?.fuelConsumptionPer100Km != null && vehicleSummary?.fuelCostPer100Km != null ? <><strong>{formatFuelLiters(vehicleSummary.fuelConsumptionPer100Km)} л/100 км</strong><small>{formatMoney(vehicleSummary.fuelCostPer100Km)} за 100 км</small></> : <strong>Нет данных</strong>}</div>
              <div className="efficiency-rate"><span>Последняя заправка</span>{vehicleSummary?.latestFuelConsumptionPer100Km != null && vehicleSummary?.latestFuelCostPer100Km != null ? <><strong>{formatFuelLiters(vehicleSummary.latestFuelConsumptionPer100Km)} л/100 км</strong><small>{formatMoney(vehicleSummary.latestFuelCostPer100Km)} за 100 км</small></> : <strong>Нет данных</strong>}</div>
            </div>
            {vehicleSummary && !vehicleSummary.mileageComplete && <MileageNotice summary={vehicleSummary} />}
          </article>
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

      {view === 'savings' && <SavingsView goals={savings} setGoals={setSavings} setError={setError} />}

      {view === 'categories' && <article className="card settings-card">
        <CardTitle title="Категории операций" subtitle="Используются во всех годах" />
        <div className="category-groups"><CategoryGroup title="Расходы" items={categories.filter((item) => item.type === 'EXPENSE')} /><CategoryGroup title="Доходы" items={categories.filter((item) => item.type === 'INCOME')} /></div>
        <form className="category-form" onSubmit={addCategory}><input required value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Название новой категории" /><select value={categoryType} onChange={(event) => setCategoryType(event.target.value as TransactionType)}><option value="EXPENSE">Расход</option><option value="INCOME">Доход</option></select><button className="primary">Добавить</button></form>
      </article>}
    </main>
    <button className="quick-add" onClick={() => { cancelEdit(); setCreatingOperation(true); }} aria-label="Добавить операцию"><span>＋</span><b>Операция</b></button>
    {editingId && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) cancelEdit();
    }}>
      <section className="card operation-modal" role="dialog" aria-modal="true" aria-labelledby="edit-operation-title">
        <button type="button" className="modal-close" onClick={cancelEdit} aria-label="Закрыть">×</button>
        <div className="card-title"><div><h2 id="edit-operation-title">Редактировать операцию</h2><p>Операция №{editingId}</p></div></div>
        <OperationForm form={form} setForm={setForm} categories={availableCategories} vehicles={vehicles} editing onType={changeType} onSubmit={saveOperation} onCancel={cancelEdit} />
      </section>
    </div>}
    {creatingOperation && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeOperationModal(); }}>
      <section className="card operation-modal" role="dialog" aria-modal="true" aria-labelledby="create-operation-title">
        <button type="button" className="modal-close" onClick={closeOperationModal} aria-label="Закрыть">×</button>
        <div className="card-title"><div><h2 id="create-operation-title">Новая операция</h2><p>Дата и выбранный тип сохраняются между записями</p></div></div>
        <OperationForm form={form} setForm={setForm} categories={availableCategories} vehicles={vehicles} editing={false} onType={changeType} onSubmit={saveOperation} onCancel={closeOperationModal} />
      </section>
    </div>}
  </div>;
}

function OperationForm({ form, setForm, categories, vehicles, editing, onType, onSubmit, onCancel }: any) {
  return <form className="transaction-form" onSubmit={onSubmit}>
    <div className="segmented"><button type="button" className={form.type === 'EXPENSE' ? 'selected' : ''} onClick={() => onType('EXPENSE')}>Расход</button><button type="button" className={form.type === 'INCOME' ? 'selected' : ''} onClick={() => onType('INCOME')}>Доход</button></div>
    <label>Категория<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value, vehicleExpenseType: 'OTHER', odometerKm: '', fuelLiters: '' })}>{categories.map((category: Category) => <option key={category.id}>{category.name}</option>)}</select></label>
    <label>Сумма<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0 ₽" /></label>
    {form.category === 'Машина' && <>
      <fieldset className="vehicle-subtype"><legend>Тип расхода</legend><div><button type="button" className={form.vehicleExpenseType === 'OTHER' ? 'selected' : ''} onClick={() => setForm({ ...form, vehicleExpenseType: 'OTHER', odometerKm: '', fuelLiters: '' })}>Прочее</button><button type="button" className={form.vehicleExpenseType === 'MAINTENANCE' ? 'selected' : ''} onClick={() => setForm({ ...form, vehicleExpenseType: 'MAINTENANCE', odometerKm: '', fuelLiters: '' })}>Тех. обслуживание</button><button type="button" className={form.vehicleExpenseType === 'FUEL' ? 'selected' : ''} onClick={() => setForm({ ...form, vehicleExpenseType: 'FUEL' })}>Бензин</button></div></fieldset>
      {form.vehicleExpenseType === 'FUEL' && <><label>Пробег на одометре, км<input type="number" min="1" step="1" value={form.odometerKm} onChange={(event) => setForm({ ...form, odometerKm: event.target.value })} placeholder="Например, 48 250" /></label><label>Заправлено, литров<input type="number" min="0.001" step="0.001" value={form.fuelLiters} onChange={(event) => setForm({ ...form, fuelLiters: event.target.value })} placeholder="Например, 42.5" /><small>Для точного расчёта заполняйте оба поля при каждой заправке.</small></label></>}
      <label>Автомобиль<select required value={form.vehicleId ?? ''} onChange={(event) => setForm({ ...form, vehicleId: Number(event.target.value) })}>{vehicles.map((vehicle: Vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></label>
    </>}
    <label>Дата<input required type="date" value={form.transactionDate} onChange={(event) => setForm({ ...form, transactionDate: event.target.value })} /></label>
    <label className="comment-field">Комментарий<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Необязательно" /></label>
    <div className="form-actions"><button className="primary">{editing ? 'Сохранить изменения' : 'Сохранить операцию'}</button>{editing && <button type="button" className="secondary" onClick={onCancel}>Отмена</button>}</div>
  </form>;
}

function TransactionTable({ items, loading, onEdit, onDelete }: { items: Transaction[]; loading: boolean; onEdit: (item: Transaction) => void; onDelete: (item: Transaction) => void }) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const categoryOptions = useMemo(() => [...new Set(items.map((item) => item.category))].sort((a, b) => a.localeCompare(b, 'ru')), [items]);
  const filteredItems = selectedCategories.length
    ? items.filter((item) => selectedCategories.includes(item.category))
    : items;

  useEffect(() => {
    setSelectedCategories((current) => current.filter((category) => categoryOptions.includes(category)));
  }, [categoryOptions]);

  const subtitle = loading
    ? 'Загрузка…'
    : selectedCategories.length ? `${filteredItems.length} из ${items.length} записей` : `${items.length} записей`;

  function toggleCategory(category: string) {
    setSelectedCategories((current) => current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category]);
  }

  return <section className="card transactions">
    <div className="transactions-head">
      <CardTitle title="Операции" subtitle={subtitle} />
      <details className="category-filter">
        <summary>
          <span>{selectedCategories.length ? `Категории: ${selectedCategories.length}` : 'Все категории'}</span>
          <i aria-hidden="true" />
        </summary>
        <div className="category-filter-menu">
          <div className="category-filter-menu-head">
            <strong>Категории</strong>
            {selectedCategories.length > 0 && <button type="button" onClick={() => setSelectedCategories([])}>Сбросить</button>}
          </div>
          <div className="category-filter-options">
            {categoryOptions.map((category) => <label key={category}>
              <input type="checkbox" checked={selectedCategories.includes(category)}
                onChange={() => toggleCategory(category)} />
              <span>{category}</span>
            </label>)}
          </div>
        </div>
      </details>
    </div>
    <div className="table-wrap"><table><thead><tr><th>Дата</th><th>Категория</th><th>Комментарий</th><th>Сумма</th><th /></tr></thead><tbody>{filteredItems.map((item) => <tr key={item.id}><td>{formatDate(item.transactionDate)}</td><td><b>{item.category}{item.vehicleExpenseType ? ` · ${vehicleExpenseTypeLabel(item.vehicleExpenseType)}` : ''}</b>{(item.odometerKm != null || item.fuelLiters != null) && <small className="odometer-note">{item.odometerKm != null ? `${formatNumber(item.odometerKm)} км` : ''}{item.odometerKm != null && item.fuelLiters != null ? ' · ' : ''}{item.fuelLiters != null ? `${formatFuelLiters(item.fuelLiters)} л` : ''}</small>}</td><td>{item.description || '—'}</td><td className={item.type === 'INCOME' ? 'money-in' : 'money-out'}>{item.type === 'INCOME' ? '+' : '−'} {formatMoney(item.amount)}</td><td className="row-actions"><button onClick={() => onEdit(item)} title="Редактировать">✎</button><button className="delete" onClick={() => onDelete(item)} title="Удалить">×</button></td></tr>)}</tbody></table></div>
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
            <div><div className="debt-meta"><span className="debt-status">{debt.remainingAmount === 0 ? 'Погашен' : 'Активный долг'}</span>
              {debt.name.trim().toLocaleLowerCase('ru-RU') === 'яндекс сплит' && debt.remainingAmount > 0 &&
                <span className="debt-overdue"><i />{yandexSplitOverdueDays()} дней просрочки</span>}
            </div><h2>{debt.name}</h2><p>{debt.note || `Создан ${formatDate(debt.createdDate)}`}</p></div>
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

const savingsColors = ['#6c5ce7', '#00b894', '#0984e3', '#e84393', '#e17055', '#fdcb6e'];
const freshSavingsForm = () => ({ name: '', targetAmount: '', targetDate: '', createdDate: new Date().toISOString().slice(0, 10), note: '', color: savingsColors[0] });
const freshSavingsEntry = () => ({ amount: '', entryDate: new Date().toISOString().slice(0, 10), comment: '', withdrawal: false });

function SavingsView({ goals, setGoals, setError }: { goals: SavingsGoal[]; setGoals: React.Dispatch<React.SetStateAction<SavingsGoal[]>>; setError: (value: string) => void }) {
  const [form, setForm] = useState(freshSavingsForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activeGoalId, setActiveGoalId] = useState<number | null>(null);
  const [entry, setEntry] = useState(freshSavingsEntry);
  const saved = goals.reduce((sum, goal) => sum + goal.savedAmount, 0);
  const target = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const monthly = goals.reduce((sum, goal) => sum + goal.averageMonthly, 0);

  async function refresh() { setGoals(await getSavings()); }
  async function saveGoal(event: React.FormEvent) {
    event.preventDefault();
    const payload = { ...form, targetAmount: Number(form.targetAmount), targetDate: form.targetDate || null };
    try {
      if (editingId) await updateSavingsGoal(editingId, payload); else await createSavingsGoal(payload);
      await refresh(); setEditingId(null); setForm(freshSavingsForm()); setError('');
    } catch (requestError) { setError(message(requestError)); }
  }
  function editGoal(goal: SavingsGoal) {
    setEditingId(goal.id);
    setForm({ name: goal.name, targetAmount: String(goal.targetAmount), targetDate: goal.targetDate ?? '', createdDate: goal.createdDate, note: goal.note, color: goal.color });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function removeGoal(goal: SavingsGoal) {
    if (!window.confirm(`Удалить цель «${goal.name}» вместе с историей?`)) return;
    try { await deleteSavingsGoal(goal.id); await refresh(); } catch (requestError) { setError(message(requestError)); }
  }
  async function submitEntry(event: React.FormEvent, goal: SavingsGoal) {
    event.preventDefault();
    try {
      await addSavingsEntry(goal.id, { ...entry, amount: Number(entry.amount) });
      await refresh(); setActiveGoalId(null); setEntry(freshSavingsEntry());
    } catch (requestError) { setError(message(requestError)); }
  }
  async function removeEntry(goalId: number, entryId: number) {
    if (!window.confirm('Удалить эту запись из истории накоплений?')) return;
    try { await deleteSavingsEntry(goalId, entryId); await refresh(); } catch (requestError) { setError(message(requestError)); }
  }

  return <>
    <section className="metrics savings-metrics">
      <Metric title="Накоплено" value={saved} kind="income" />
      <Metric title="Общая цель" value={target} kind="balance" />
      <Metric title="Осталось" value={Math.max(0, target - saved)} kind="expense" />
      <Metric title="Средний темп в месяц" value={monthly} kind="daily" />
    </section>
    <section className="savings-layout">
      <article className="card savings-editor">
        <CardTitle title={editingId ? 'Редактировать цель' : 'Новая цель'} subtitle="На что и сколько откладываем" />
        <form className="debt-form" onSubmit={saveGoal}>
          <label>Название<input required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Например, финансовая подушка" /></label>
          <div className="debt-form-row">
            <label>Нужно накопить<input required type="number" min="0.01" step="0.01" value={form.targetAmount} onChange={(event) => setForm({ ...form, targetAmount: event.target.value })} placeholder="0 ₽" /></label>
            <label>Желаемая дата<input type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} /></label>
          </div>
          <label>Комментарий<input maxLength={1000} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Зачем эта цель важна" /></label>
          <fieldset className="goal-colors"><legend>Цвет цели</legend><div>{savingsColors.map((color) => <button key={color} type="button" className={form.color === color ? 'selected' : ''} style={{ background: color }} onClick={() => setForm({ ...form, color })} aria-label={`Выбрать цвет ${color}`} />)}</div></fieldset>
          <div className="form-actions"><button className="primary">{editingId ? 'Сохранить изменения' : 'Создать цель'}</button>{editingId && <button className="secondary" type="button" onClick={() => { setEditingId(null); setForm(freshSavingsForm()); }}>Отмена</button>}</div>
        </form>
        <p className="savings-hint">Пополнения не попадут в расходы: накопления остаются вашими деньгами.</p>
      </article>
      <div className="savings-list">
        {goals.length === 0 && <article className="card debt-empty"><span>◎</span><h2>Пока нет целей</h2><p>Создайте первую — например, финансовую подушку.</p></article>}
        {goals.map((goal) => <article className={`card savings-card ${goal.progressPercent >= 100 ? 'complete' : ''}`} key={goal.id} style={{ '--goal-color': goal.color } as React.CSSProperties}>
          <div className="debt-card-head"><div><span className="debt-status">{goal.progressPercent >= 100 ? 'Цель достигнута' : 'Активная цель'}</span><h2>{goal.name}</h2><p>{goal.note || (goal.targetDate ? `Цель к ${formatDate(goal.targetDate)}` : 'Без установленного срока')}</p></div><div className="debt-actions"><button onClick={() => editGoal(goal)} title="Редактировать">✎</button><button className="delete" onClick={() => void removeGoal(goal)} title="Удалить">×</button></div></div>
          <div className="savings-amount"><strong>{formatMoney(goal.savedAmount)}</strong><span>из {formatMoney(goal.targetAmount)}</span></div>
          <div className="debt-progress"><i style={{ width: `${Math.min(100, goal.progressPercent)}%`, background: goal.color }} /></div>
          <div className="debt-progress-label"><span>{goal.progressPercent}%</span><span>осталось {formatMoney(goal.remainingAmount)}</span></div>
          <div className="savings-insights">
            <div><span>Темп</span><strong>{goal.averageMonthly > 0 ? `${formatMoney(goal.averageMonthly)}/мес.` : 'Пока считаем'}</strong></div>
            <div><span>{goal.targetDate ? 'Нужно откладывать' : 'Прогноз'}</span><strong>{goal.targetDate && goal.remainingAmount > 0 ? `${formatMoney(goal.recommendedMonthly)}/мес.` : goal.projectedDate ? formatDate(goal.projectedDate) : 'Нет данных'}</strong></div>
          </div>
          {activeGoalId === goal.id ? <form className="payment-form savings-entry-form" onSubmit={(event) => void submitEntry(event, goal)}>
            <div className="segmented savings-entry-type"><button type="button" className={!entry.withdrawal ? 'selected' : ''} onClick={() => setEntry({ ...entry, withdrawal: false })}>Пополнить</button><button type="button" className={entry.withdrawal ? 'selected' : ''} onClick={() => setEntry({ ...entry, withdrawal: true })}>Снять</button></div>
            <label>Сумма<input autoFocus required type="number" min="0.01" step="0.01" value={entry.amount} onChange={(event) => setEntry({ ...entry, amount: event.target.value })} /></label>
            <label>Дата<input required type="date" value={entry.entryDate} onChange={(event) => setEntry({ ...entry, entryDate: event.target.value })} /></label>
            <label className="payment-comment">Комментарий<input value={entry.comment} onChange={(event) => setEntry({ ...entry, comment: event.target.value })} placeholder="Необязательно" /></label>
            <div className="form-actions"><button className="primary">{entry.withdrawal ? 'Снять из цели' : 'Добавить в цель'}</button><button type="button" className="secondary" onClick={() => setActiveGoalId(null)}>Отмена</button></div>
          </form> : <button className="primary debt-pay-button" onClick={() => { setActiveGoalId(goal.id); setEntry(freshSavingsEntry()); }}>＋ Изменить сумму</button>}
          {goal.entries.length > 0 && <details className="payment-history"><summary>История · {goal.entries.length}</summary><div>{goal.entries.map((item) => <p key={item.id}><span>{formatDate(item.entryDate)}{item.comment ? ` · ${item.comment}` : ''}</span><b className={item.amount >= 0 ? 'money-in' : 'money-out'}>{item.amount >= 0 ? '+' : '−'} {formatMoney(Math.abs(item.amount))}</b><button className="entry-delete" onClick={() => void removeEntry(goal.id, item.id)} title="Удалить">×</button></p>)}</div></details>}
        </article>)}
      </div>
    </section>
  </>;
}

const MonthlyChart = memo(function MonthlyChart({ data, theme }: {
  data: Array<{ monthLabel: string; income: number; expense: number }>;
  theme: 'light' | 'dark';
}) {
  return <ResponsiveContainer width="100%" height={320}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#3b394d' : '#e9e8f0'} /><XAxis dataKey="monthLabel" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} tickFormatter={compactMoney} /><Tooltip formatter={(value, name) => [formatMoney(Number(value)), name]} contentStyle={tooltipStyle(theme)} /><Legend /><Bar dataKey="income" name="Доход" fill="#00b894" radius={[5, 5, 0, 0]} /><Bar dataKey="expense" name="Расход" fill="#6c5ce7" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>;
});

const CategoryChart = memo(function CategoryChart({ points, expense, theme }: {
  points: Summary['categoryPoints'];
  expense: number;
  theme: 'light' | 'dark';
}) {
  return <ResponsiveContainer width="100%" height={270}><PieChart><Pie data={points} dataKey="amount" nameKey="category" innerRadius={72} outerRadius={108} paddingAngle={1} cornerRadius={4} stroke="none">{points.map((entry, index) => <Cell key={entry.category} fill={colors[index % colors.length]} />)}<Label value="Расходы" position="center" dy={-12} className="donut-caption" /><Label value={compactMoney(expense)} position="center" dy={13} className="donut-total" /></Pie><Tooltip formatter={(value, _name, item) => [`${formatMoney(Number(value))} · ${expense ? ((Number(value) / expense) * 100).toFixed(1) : '0'}%`, item.payload?.category ?? 'Категория']} contentStyle={tooltipStyle(theme)} /></PieChart></ResponsiveContainer>;
});

function Metric({ title, value, kind, plain, suffix = '' }: { title: string; value?: number; kind?: string; plain?: boolean; suffix?: string }) { return <article className={`metric ${kind ?? ''}`}><span>{title}</span><strong>{plain ? `${formatNumber(value ?? 0)}${suffix}` : formatMoney(value ?? 0)}</strong></article>; }
function MileageNotice({ summary }: { summary: VehicleSummary }) {
  const onlyOneReading = summary.firstOdometerKm != null && summary.firstOdometerKm === summary.latestOdometerKm;
  return <div className="mileage-notice"><strong>Расчёт ₽/100 км пока недоступен</strong><span>{summary.firstOdometerKm == null
    ? 'Укажите пробег минимум в двух операциях «Бензин».'
    : onlyOneReading ? 'Нужна ещё одна операция «Бензин» с новым показанием одометра.'
      : 'После первой отметки есть заправка без пробега или объёма топлива — средний расход невозможно рассчитать корректно.'}</span></div>;
}
function CardTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div className="card-title"><div><h2>{title}</h2><p>{subtitle}</p></div></div>; }
function title(view: View, month: number | null, year: number) { if (view === 'transactions') return 'Операции'; if (view === 'vehicles') return 'Автомобиль'; if (view === 'debts') return 'Долги'; if (view === 'savings') return 'Накопления'; if (view === 'categories') return 'Категории'; return month ? months[month - 1] : `Весь ${year} год`; }
function subtitle(view: View, month: number | null) { if (view === 'transactions') return 'Полный журнал'; if (view === 'vehicles') return 'Расходы на транспорт'; if (view === 'debts') return 'Контроль обязательств'; if (view === 'savings') return 'Цели и финансовая подушка'; if (view === 'categories') return 'Настройки справочника'; return month ? 'Отчёт за месяц' : 'Финансовый обзор'; }
const moneyFormatter = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 });
const compactMoneyFormatter = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat('ru-RU');
const numberFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const fuelLitersFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 });
function formatMoney(value: number) { return moneyFormatter.format(value); }
function compactMoney(value: number) { return compactMoneyFormatter.format(value); }
function formatDate(value: string) { return dateFormatter.format(new Date(`${value}T00:00:00`)); }
function formatNumber(value: number) { return numberFormatter.format(value); }
function formatFuelLiters(value: number) { return fuelLitersFormatter.format(value); }
function vehicleExpenseTypeLabel(value: VehicleExpenseType) {
  if (value === 'FUEL') return 'Бензин';
  if (value === 'MAINTENANCE') return 'Тех. обслуживание';
  return 'Прочее';
}
function yandexSplitOverdueDays() {
  const today = new Date();
  return Math.max(0, Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(2024, 8, 16)) / 86_400_000));
}
function message(error: unknown) { return error instanceof Error ? error.message : 'Произошла ошибка'; }
function tooltipStyle(theme: 'light' | 'dark') {
  return {
    background: theme === 'dark' ? '#302e43' : '#ffffff',
    border: `1px solid ${theme === 'dark' ? '#49465d' : '#e5e2ec'}`,
    borderRadius: '10px',
    color: theme === 'dark' ? '#f6f4ff' : '#242334',
  };
}
