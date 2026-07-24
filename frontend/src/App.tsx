import { useEffect, useState } from 'react';
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
import { createTransaction, getSummary, getTransactions } from './api';
import type { Summary, Transaction, TransactionType } from './types';

const initialForm = {
  type: 'EXPENSE' as TransactionType,
  category: 'Food',
  amount: '0',
  transactionDate: new Date().toISOString().slice(0, 10),
  description: '',
};

const expensePalette = ['#ff6b6b', '#ff8787', '#ffa8a8', '#ffd6d6', '#ffc9c9'];

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [transactionsData, summaryData] = await Promise.all([getTransactions(), getSummary()]);
      setTransactions(transactionsData);
      setSummary(summaryData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await createTransaction({
        type: form.type,
        category: form.category,
        amount: Number(form.amount),
        transactionDate: form.transactionDate,
        description: form.description,
      });
      setForm((current) => ({ ...current, amount: '0', description: '' }));
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error');
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Personal finance dashboard</p>
          <h1>Control cash flow without spreadsheet fatigue.</h1>
          <p className="hero-copy">
            Track income and expenses, keep categories clean, and see your month at a glance.
          </p>
        </div>
        <div className="hero-stats">
          <div className="stat-card accent">
            <span>Balance</span>
            <strong>{summary ? formatMoney(summary.balance) : '—'}</strong>
          </div>
          <div className="stat-row">
            <div className="stat-card">
              <span>Income</span>
              <strong>{summary ? formatMoney(summary.income) : '—'}</strong>
            </div>
            <div className="stat-card">
              <span>Expense</span>
              <strong>{summary ? formatMoney(summary.expense) : '—'}</strong>
            </div>
          </div>
        </div>
      </header>

      <main className="grid-layout">
        <section className="panel form-panel">
          <div className="section-title">
            <h2>New entry</h2>
            <p>Add income or an expense.</p>
          </div>
          <form className="entry-form" onSubmit={handleSubmit}>
            <label>
              Type
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as TransactionType })}>
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </select>
            </label>
            <label>
              Category
              <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            </label>
            <label>
              Amount
              <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            </label>
            <label>
              Date
              <input type="date" value={form.transactionDate} onChange={(event) => setForm({ ...form, transactionDate: event.target.value })} />
            </label>
            <label className="wide">
              Description
              <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Salary, groceries, rent..." />
            </label>
            <button type="submit">Save transaction</button>
          </form>
          {error ? <p className="error-box">{error}</p> : null}
        </section>

        <section className="panel chart-panel">
          <div className="section-title">
            <h2>Monthly flow</h2>
            <p>Income vs expense by month.</p>
          </div>
          <div className="chart-frame">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={summary?.monthlyPoints ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                <XAxis dataKey="month" stroke="#d8dee9" />
                <YAxis stroke="#d8dee9" />
                <Tooltip />
                <Legend />
                <Bar dataKey="income" fill="#3ddc97" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expense" fill="#ff6b6b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel chart-panel">
          <div className="section-title">
            <h2>Expense split</h2>
            <p>Where the money goes.</p>
          </div>
          <div className="chart-frame">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={summary?.categoryPoints ?? []} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={100} innerRadius={62} paddingAngle={4}>
                  {(summary?.categoryPoints ?? []).map((entry, index) => (
                    <Cell key={entry.category} fill={expensePalette[index % expensePalette.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel table-panel">
          <div className="section-title">
            <h2>Recent transactions</h2>
            <p>{loading ? 'Loading data...' : `${transactions.length} entries`}</p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th className="amount-col">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.transactionDate}</td>
                    <td>{transaction.type === 'INCOME' ? 'Income' : 'Expense'}</td>
                    <td>{transaction.category}</td>
                    <td>{transaction.description}</td>
                    <td className={transaction.type === 'INCOME' ? 'positive' : 'negative'}>{formatMoney(transaction.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}
