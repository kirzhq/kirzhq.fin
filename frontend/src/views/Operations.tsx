import { useMemo, useState } from 'react';
import { categoryColor, operationDetails } from '../categories';
import { Icon } from '../components/Icon';
import { ErrorState, Loading, OperationList, PageHead, PeriodControl } from '../components/ui';
import { money, plural } from '../format';
import { useFinance } from '../store';
import type { TransactionType } from '../types';

export function Operations({ category, setCategory }: { category: string | null; setCategory: (value: string | null) => void }) {
  const { period, setPeriod, data, loadError, reload, openOperation } = useFinance();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<TransactionType | 'ALL'>('ALL');

  const items = data?.transactions ?? [];
  const present = useMemo(() => {
    const seen = new Map<string, TransactionType>();
    items.forEach((item) => { if (!seen.has(item.category)) seen.set(item.category, item.type); });
    return [...seen.entries()].sort((left, right) => left[1].localeCompare(right[1]) || left[0].localeCompare(right[0], 'ru'));
  }, [items]);

  const needle = query.trim().toLowerCase().replace(',', '.');
  const filtered = items.filter((item) => (type === 'ALL' || item.type === type)
    && (!category || item.category === category)
    && (!needle || `${item.category} ${operationDetails(item)} ${item.amount}`.toLowerCase().includes(needle)));
  const total = filtered.reduce((sum, item) => sum + (item.type === 'INCOME' ? item.amount : -item.amount), 0);
  const filteredOut = filtered.length !== items.length;

  return <>
    <PageHead kicker="Финансы" title="Операции">
      <PeriodControl period={period} onChange={setPeriod} />
      <button type="button" className="btn primary head-add" onClick={() => openOperation(category ? { category } : {})}><Icon name="plus" />Операция</button>
    </PageHead>
    {loadError && !data && <ErrorState text={loadError} onRetry={() => void reload()} />}
    <section className="panel">
      <div className="filters">
        <label className="search"><Icon name="search" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск: «Я.Еда», «бензин», 1840" aria-label="Поиск по операциям" />
          {query && <button type="button" className="clear" onClick={() => setQuery('')} aria-label="Очистить поиск"><Icon name="close" /></button>}
        </label>
        <div className="seg" role="group" aria-label="Тип">
          <button type="button" aria-pressed={type === 'ALL'} onClick={() => setType('ALL')}>Все</button>
          <button type="button" aria-pressed={type === 'EXPENSE'} onClick={() => setType('EXPENSE')}>Расходы</button>
          <button type="button" aria-pressed={type === 'INCOME'} onClick={() => setType('INCOME')}>Доходы</button>
        </div>
      </div>
      {present.length > 1 && <div className="chips filter-chips">
        {present.map(([name, kind]) => <button type="button" key={name} className="chip" aria-pressed={category === name}
          onClick={() => setCategory(category === name ? null : name)}>
          <i className="dot" style={{ background: categoryColor(name, kind) }} />{name}
        </button>)}
      </div>}
      {!data && !loadError && <Loading />}
      {data && <>
        <p className="muted small result-line">
          {filtered.length} {plural(filtered.length, 'операция', 'операции', 'операций')}
          {filteredOut ? ` из ${items.length}` : ''} · итог <span className="num">{money(total, true)}</span>
          {(filteredOut || category) && <> · <button type="button" className="link small" onClick={() => { setQuery(''); setType('ALL'); setCategory(null); }}>сбросить фильтры</button></>}
        </p>
        <OperationList items={filtered} onOpen={(operation) => openOperation({ operation })}
          empty={items.length ? 'Ничего не нашлось. Попробуйте изменить поиск или фильтр.' : 'За этот период операций нет.'} />
      </>}
    </section>
  </>;
}
