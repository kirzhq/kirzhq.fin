import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  createCategory,
  createTransaction,
  getCategories,
  getSummary,
  getTransactions,
} from './api';
import type { Category, Summary, Transaction, TransactionType } from './types';

const months = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const shortMonths = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const colors = ['#6c5ce7', '#00b894', '#fdcb6e', '#e17055', '#0984e3', '#e84393', '#00cec9', '#a29bfe'];
const today = new Date();

export default function App() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState<TransactionType>('EXPENSE');
  const [form, setForm] = useState({
    type: 'EXPENSE' as TransactionType,
    category: '',
    amount: '',
    transactionDate: today.toISOString().slice(0, 10),
    description: '',
  });

  const availableCategories = useMemo(
    () => categories.filter((category) => category.type === form.type),
    [categories, form.type],
  );

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [transactionData, summaryData, categoryData] = await Promise.all([
        getTransactions(year, month),
        getSummary(year, month),
        getCategories(),
      ]);
      setTransactions(transactionData);
      setSummary(summaryData);
      setCategories(categoryData);
      setForm((current) => {
        const matching = categoryData.filter((category) => category.type === current.type);
        return { ...current, category: matching.some((item) => item.name === current.category) ? current.category : matching[0]?.name ?? '' };
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [year, month]);

  async function addTransaction(event: React.FormEvent) {
    event.preventDefault();
    try {
      await createTransaction({
        ...form,
        amount: Number(form.amount),
      });
      setForm((current) => ({ ...current, amount: '', description: '' }));
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось сохранить операцию');
    }
  }

  async function addCategory(event: React.FormEvent) {
    event.preventDefault();
    if (!categoryName.trim()) return;
    try {
      const created = await createCategory({ name: categoryName.trim(), type: categoryType });
      setCategoryName('');
      setCategories((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name, 'ru')));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось создать категорию');
    }
  }

  const chartData = (summary?.monthlyPoints ?? []).map((point, index) => ({
    ...point,
    monthLabel: shortMonths[index] ?? point.month,
  }));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span>₽</span><strong>Мои финансы</strong></div>
        <nav>
          <button className={month === null ? 'active' : ''} onClick={() => setMonth(null)}>Обзор за год</button>
          <p>Месяцы</p>
          {months.map((name, index) => (
            <button key={name} className={month === index + 1 ? 'active' : ''} onClick={() => setMonth(index + 1)}>
              {name}
            </button>
          ))}
        </nav>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="kicker">{month ? 'Отчёт за месяц' : 'Финансовый обзор'}</p>
            <h1>{month ? months[month - 1] : `Весь ${year} год`}</h1>
          </div>
          <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {[2024, 2025, 2026, 2027].map((value) => <option key={value}>{value}</option>)}
          </select>
        </header>

        {error && <div className="error">{error}<button onClick={() => setError('')}>×</button></div>}

        <section className="metrics">
          <Metric title="Доход" value={summary?.income} kind="income" />
          <Metric title="Расход" value={summary?.expense} kind="expense" />
          <Metric title="Сальдо" value={summary?.balance} kind="balance" />
          <Metric title="Операций" value={transactions.length} plain />
        </section>

        <section className="content-grid">
          <article className="card flow-card">
            <CardTitle title={month ? 'Доходы и расходы' : 'Динамика по месяцам'} subtitle={month ? months[month - 1] : `${year} год`} />
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9e8f0" />
                <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={compactMoney} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Legend formatter={(value) => value === 'income' ? 'Доход' : 'Расход'} />
                <Bar dataKey="income" fill="#00b894" radius={[5, 5, 0, 0]} />
                <Bar dataKey="expense" fill="#6c5ce7" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </article>

          <article className="card category-chart">
            <CardTitle title="Расходы по категориям" subtitle={month ? months[month - 1] : `${year} год`} />
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={summary?.categoryPoints ?? []} dataKey="amount" nameKey="category" innerRadius={62} outerRadius={92} paddingAngle={2}>
                  {(summary?.categoryPoints ?? []).map((entry, index) => <Cell key={entry.category} fill={colors[index % colors.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="legend-list">
              {(summary?.categoryPoints ?? []).slice(0, 6).map((point, index) => (
                <div key={point.category}><i style={{ background: colors[index % colors.length] }} /><span>{point.category}</span><strong>{formatMoney(point.amount)}</strong></div>
              ))}
            </div>
          </article>
        </section>

        <section className="content-grid lower">
          <article className="card">
            <CardTitle title="Добавить операцию" subtitle="Доход или расход" />
            <form className="transaction-form" onSubmit={addTransaction}>
              <div className="segmented">
                <button type="button" className={form.type === 'EXPENSE' ? 'selected' : ''} onClick={() => setForm({ ...form, type: 'EXPENSE', category: categories.find((c) => c.type === 'EXPENSE')?.name ?? '' })}>Расход</button>
                <button type="button" className={form.type === 'INCOME' ? 'selected' : ''} onClick={() => setForm({ ...form, type: 'INCOME', category: categories.find((c) => c.type === 'INCOME')?.name ?? '' })}>Доход</button>
              </div>
              <label>Категория<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{availableCategories.map((category) => <option key={category.id}>{category.name}</option>)}</select></label>
              <label>Сумма<input required type="number" min="0.01" step="0.01" placeholder="0 ₽" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
              <label>Дата<input required type="date" value={form.transactionDate} onChange={(event) => setForm({ ...form, transactionDate: event.target.value })} /></label>
              <label>Комментарий<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Необязательно" /></label>
              <button className="primary" type="submit">Сохранить операцию</button>
            </form>
          </article>

          <article className="card">
            <CardTitle title="Категории" subtitle={`${categories.length} категорий`} />
            <div className="category-pills">{categories.map((category) => <span key={category.id} className={category.type === 'INCOME' ? 'income-pill' : ''}>{category.name}</span>)}</div>
            <form className="category-form" onSubmit={addCategory}>
              <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Название новой категории" />
              <select value={categoryType} onChange={(event) => setCategoryType(event.target.value as TransactionType)}>
                <option value="EXPENSE">Расход</option><option value="INCOME">Доход</option>
              </select>
              <button className="primary">Добавить</button>
            </form>
          </article>
        </section>

        <section className="card transactions">
          <CardTitle title="Операции" subtitle={loading ? 'Загрузка…' : `${transactions.length} записей`} />
          <div className="table-wrap"><table><thead><tr><th>Дата</th><th>Категория</th><th>Комментарий</th><th>Тип</th><th>Сумма</th></tr></thead>
            <tbody>{transactions.map((transaction) => <tr key={transaction.id}>
              <td>{formatDate(transaction.transactionDate)}</td><td><b>{transaction.category}</b></td><td>{transaction.description || '—'}</td>
              <td><span className={`type ${transaction.type.toLowerCase()}`}>{transaction.type === 'INCOME' ? 'Доход' : 'Расход'}</span></td>
              <td className={transaction.type === 'INCOME' ? 'money-in' : 'money-out'}>{transaction.type === 'INCOME' ? '+' : '−'} {formatMoney(transaction.amount)}</td>
            </tr>)}</tbody>
          </table></div>
        </section>
      </main>
    </div>
  );
}

function Metric({ title, value, kind, plain }: { title: string; value?: number; kind?: string; plain?: boolean }) {
  return <article className={`metric ${kind ?? ''}`}><span>{title}</span><strong>{plain ? value ?? 0 : formatMoney(value ?? 0)}</strong></article>;
}
function CardTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="card-title"><div><h2>{title}</h2><p>{subtitle}</p></div></div>;
}
function formatMoney(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(value);
}
function compactMoney(value: number) {
  return new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU').format(new Date(`${value}T00:00:00`));
}
