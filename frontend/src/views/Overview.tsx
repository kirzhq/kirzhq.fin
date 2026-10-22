import { useMemo, useState } from 'react';
import { categoryColor, FOOD } from '../categories';
import { completeMonths, DailyChart, YearChart } from '../components/Charts';
import { Icon } from '../components/Icon';
import { ErrorState, Loading, OperationList, PageHead, PeriodControl, Track } from '../components/ui';
import { money, moneyRounded, MONTHS, periodTitle, plural } from '../format';
import { useFinance } from '../store';
import type { CategoryBudget, Summary, Transaction } from '../types';

export function Overview({ onCategory }: { onCategory: (category: string) => void }) {
  const { period, setPeriod, data, loadError, budgets, openOperation, reload } = useFinance();
  const isMonth = period.month !== null;

  return <>
    <PageHead kicker={isMonth ? (data?.summary.forecastAvailable ? 'Финансы · месяц идёт' : 'Финансы · итоги месяца') : 'Финансы · итоги года'} title={periodTitle(period)}>
      <PeriodControl period={period} onChange={setPeriod} />
      <button type="button" className="btn primary head-add" onClick={() => openOperation()}><Icon name="plus" />Операция</button>
    </PageHead>
    {loadError && !data && <ErrorState text={loadError} onRetry={() => void reload()} />}
    {!data && !loadError && <Loading />}
    {data && <>
      <SummaryPanel summary={data.summary} transactions={data.transactions} isMonth={isMonth} year={period.year} />
      <div className="grid2">
        <div className="col">
          <section className="panel">
            <div className="panel-h"><h2>{isMonth ? 'Расходы по дням' : 'По месяцам'}</h2></div>
            {data.transactions.length === 0
              ? <p className="empty">За {isMonth ? MONTHS[(period.month ?? 1) - 1].toLowerCase() : `${period.year} год`} операций пока нет.</p>
              : isMonth ? <DailyChart transactions={data.transactions} period={period} summary={data.summary} /> : <YearChart summary={data.summary} year={period.year} />}
          </section>
          <section className="panel">
            <div className="panel-h"><h2>Последние операции</h2><a className="link" href="#ops">Все операции<Icon name="right" /></a></div>
            <OperationList items={data.transactions.slice(0, 8)} onOpen={(operation) => openOperation({ operation })}
              empty={<>Здесь появятся операции. <button type="button" className="link" onClick={() => openOperation()}>Добавить первую</button></>} />
          </section>
        </div>
        <div className="col">
          {isMonth && budgets.length > 0 && <Limits budgets={budgets} summary={data.summary} />}
          <Categories summary={data.summary} transactions={data.transactions} onCategory={onCategory} />
        </div>
      </div>
    </>}
  </>;
}

function SummaryPanel({ summary, transactions, isMonth, year }: { summary: Summary; transactions: Transaction[]; isMonth: boolean; year: number }) {
  const balance = summary.income - summary.expense;
  const full = completeMonths(summary, year);
  const monthlyAverage = full.length ? full.reduce((sum, point) => sum + point.expense, 0) / full.length : 0;
  return <section className="panel summary" aria-label="Итоги периода">
    <div>
      <span className="lbl">Потрачено</span>
      <span className="big num">{money(summary.expense)}</span>
      {isMonth && summary.forecastAvailable && <>
        <span className="hint">{summary.calculationDays} из {summary.daysInMonth} дней · {moneyRounded(summary.averageDailyExpense)} в день</span>
        <div className="days" aria-hidden="true"><i style={{ width: `${(summary.calculationDays / summary.daysInMonth) * 100}%` }} /></div>
      </>}
      {isMonth && !summary.forecastAvailable && <span className="hint">{moneyRounded(summary.averageDailyExpense)} в день · еда {moneyRounded(summary.averageDailyFoodExpense)} в день</span>}
      {!isMonth && <span className="hint">{transactions.length} {plural(transactions.length, 'операция', 'операции', 'операций')}</span>}
    </div>
    <div><span className="lbl">Доход</span><span className="val num pos">{money(summary.income)}</span></div>
    <div><span className="lbl">Сальдо</span><span className={`val num ${balance >= 0 ? 'pos' : 'neg'}`}>{money(balance, true)}</span></div>
    {isMonth && summary.forecastAvailable && <div>
      <span className="lbl">Прогноз расходов</span><span className="val num">{moneyRounded(summary.projectedExpense)}</span>
      <span className="hint">если тратить в том же темпе; сальдо к концу месяца {moneyRounded(summary.projectedBalance)}</span>
    </div>}
    {isMonth && !summary.forecastAvailable && <div>
      <span className="lbl">Еда</span><span className="val num">{money(summary.foodExpense)}</span>
      <span className="hint">{summary.expense ? Math.round((summary.foodExpense / summary.expense) * 100) : 0}% всех расходов</span>
    </div>}
    {!isMonth && <div>
      <span className="lbl">В среднем за месяц</span><span className="val num">{full.length ? moneyRounded(monthlyAverage) : '—'}</span>
      <span className="hint">{full.length ? `по ${full.length} ${plural(full.length, 'полному месяцу', 'полным месяцам', 'полным месяцам')}` : 'нет ни одного полного месяца'}</span>
    </div>}
  </section>;
}

function Limits({ budgets, summary }: { budgets: CategoryBudget[]; summary: Summary }) {
  const spentBy = new Map(summary.categoryPoints.map((point) => [point.category, point.amount]));
  const pace = summary.forecastAvailable ? summary.calculationDays / summary.daysInMonth : 1;
  return <section className="panel">
    <div className="panel-h"><h2>Лимиты</h2><a className="link" href="#settings">Изменить<Icon name="right" /></a></div>
    <div className="limits">
      {budgets.map((budget) => {
        const spent = spentBy.get(budget.category) ?? 0;
        const share = spent / budget.monthlyLimit;
        const projected = pace ? spent / pace : spent;
        const state = share >= 1 ? 'over' : summary.forecastAvailable && projected > budget.monthlyLimit ? 'near' : 'ok';
        const note = share >= 1
          ? `превышен на ${moneyRounded(spent - budget.monthlyLimit)}`
          : state === 'near' ? `к концу месяца ≈ ${moneyRounded(projected)}` : `осталось ${moneyRounded(budget.monthlyLimit - spent)}`;
        return <div className="limit" key={budget.id}>
          <p><span><i className="dot" style={{ background: categoryColor(budget.category) }} />{budget.category}</span>
            <span className="num small">{moneyRounded(spent)} / {moneyRounded(budget.monthlyLimit)}</span></p>
          <Track percent={share * 100} tone={state === 'ok' ? undefined : state} marker={summary.forecastAvailable ? pace * 100 : undefined} />
          <p><span className={`pill ${state}`}>{Math.round(share * 100)}%</span><span className="muted small">{note}</span></p>
        </div>;
      })}
    </div>
    {summary.forecastAvailable && <p className="muted small footnote">Риска на полосе показывает, сколько месяца уже прошло. Если полоса правее риски, деньги уходят быстрее плана.</p>}
  </section>;
}

function Categories({ summary, transactions, onCategory }: { summary: Summary; transactions: Transaction[]; onCategory: (category: string) => void }) {
  const [foodOpen, setFoodOpen] = useState(false);
  const total = summary.expense;
  const food = useMemo(() => {
    const amounts = new Map<string, number>();
    transactions.filter((item) => item.type === 'EXPENSE' && item.category === FOOD)
      .forEach((item) => amounts.set(item.foodSubcategory ?? 'Без подкатегории', (amounts.get(item.foodSubcategory ?? 'Без подкатегории') ?? 0) + item.amount));
    return [...amounts.entries()].sort((left, right) => right[1] - left[1]);
  }, [transactions]);
  const percent = (value: number, of: number) => `${of ? ((value / of) * 100).toFixed(1).replace('.', ',') : '0'}%`;

  return <section className="panel">
    <div className="panel-h"><h2>Куда ушли деньги</h2>
      <span className="muted num small">{summary.categoryPoints.length} {plural(summary.categoryPoints.length, 'категория', 'категории', 'категорий')}</span></div>
    {summary.categoryPoints.length === 0 ? <p className="empty">Расходов нет.</p> : <>
      <div className="stack" aria-hidden="true">{summary.categoryPoints.map((point) =>
        <span key={point.category} style={{ width: `${(point.amount / total) * 100}%`, background: categoryColor(point.category) }} />)}</div>
      <ul className="cats">{summary.categoryPoints.map((point) => {
        const isFood = point.category === FOOD && food.length > 0;
        return <li key={point.category} className={isFood && foodOpen ? 'open' : ''}>
          <button type="button" onClick={() => (isFood ? setFoodOpen(!foodOpen) : onCategory(point.category))}
            aria-expanded={isFood ? foodOpen : undefined} title={isFood ? 'Показать подкатегории' : 'Показать операции'}>
            <span className="dot" style={{ background: categoryColor(point.category) }} />
            <span className="nm">{point.category}{isFood && <Icon name="right" />}</span>
            <span className="amt num">{money(point.amount)}</span>
            <span className="pct num">{percent(point.amount, total)}</span>
          </button>
          {isFood && foodOpen && <div className="subcats">
            {food.map(([name, amount]) => <div key={name}><span>{name}</span><span className="num">{money(amount)}</span><span className="num">{percent(amount, point.amount)}</span></div>)}
            <button type="button" className="link small" onClick={() => onCategory(FOOD)}>Все операции «Еда»<Icon name="right" /></button>
          </div>}
        </li>;
      })}</ul>
    </>}
  </section>;
}
