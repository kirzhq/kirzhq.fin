import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { categoryColor, operationDetails } from '../categories';
import { dayLabel, isFuturePeriod, money, shiftPeriod, MONTHS } from '../format';
import type { Period, Transaction } from '../types';
import { Icon } from './Icon';

/** Modal on desktop, bottom sheet on a phone. Closes on Esc and on a click outside. */
export function Sheet({ title, onClose, children, onSubmit, wide = false }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  onSubmit?: () => void;
  wide?: boolean;
}) {
  const titleId = useId();
  const panel = useRef<HTMLFormElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('locked');
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current;
    first?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('locked');
      previous?.focus?.();
    };
  }, []);

  return <div className="scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form ref={panel} tabIndex={-1} className={`sheet${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}
      onSubmit={(event) => { event.preventDefault(); onSubmit?.(); }}>
      <div className="sheet-h">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button>
      </div>
      {children}
    </form>
  </div>;
}

export function PageHead({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return <header className="pagehead">
    <div><p className="kicker">{kicker}</p><h1>{title}</h1></div>
    {children && <div className="tools">{children}</div>}
  </header>;
}

export function PeriodControl({ period, onChange, allowYear = true }: { period: Period; onChange: (period: Period) => void; allowYear?: boolean }) {
  const next = shiftPeriod(period, 1);
  const now = new Date();
  return <div className="tools-group">
    {allowYear && <div className="seg" role="group" aria-label="Период">
      <button type="button" aria-pressed={period.month !== null}
        onClick={() => onChange({ year: period.year, month: period.year === now.getFullYear() ? now.getMonth() + 1 : 12 })}>Месяц</button>
      <button type="button" aria-pressed={period.month === null} onClick={() => onChange({ year: period.year, month: null })}>Год</button>
    </div>}
    <div className="period">
      <button type="button" className="iconbtn" onClick={() => onChange(shiftPeriod(period, -1))}
        aria-label={period.month ? 'Предыдущий месяц' : 'Предыдущий год'}><Icon name="left" /></button>
      <b>{period.month ? MONTHS[period.month - 1] : period.year}{period.month && period.year !== now.getFullYear() ? ` ${period.year}` : ''}</b>
      <button type="button" className="iconbtn" disabled={isFuturePeriod(next)} onClick={() => onChange(next)}
        aria-label={period.month ? 'Следующий месяц' : 'Следующий год'}><Icon name="right" /></button>
    </div>
  </div>;
}

export function OperationList({ items, onOpen, dayTotals = true, empty }: {
  items: Transaction[];
  onOpen: (item: Transaction) => void;
  dayTotals?: boolean;
  empty?: ReactNode;
}) {
  if (!items.length) return <p className="empty">{empty ?? 'Операций нет.'}</p>;
  const groups: Array<{ date: string; items: Transaction[] }> = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.transactionDate) last.items.push(item);
    else groups.push({ date: item.transactionDate, items: [item] });
  }
  return <div className="ops">{groups.map((group) => {
    const spent = group.items.filter((item) => item.type === 'EXPENSE' && !item.excludedFromTotals).reduce((sum, item) => sum + item.amount, 0);
    return <section key={group.date} aria-label={dayLabel(group.date)}>
      <div className="day-h"><b>{dayLabel(group.date)}</b>{dayTotals && spent > 0 && <span className="num">−{money(spent)}</span>}</div>
      {group.items.map((item) => <button type="button" key={item.id} className="op" onClick={() => onOpen(item)}>
        <span className="dot" style={{ background: categoryColor(item.category, item.type) }} />
        <span className="op-text">
          <span className="t">{item.category}{item.excludedFromTotals && <span className="pill" title="Хранится для истории машины, в суммы и графики не входит">не в итогах</span>}</span>
          <span className="s">{operationDetails(item) || ' '}</span>
        </span>
        <span className={`a num${item.type === 'INCOME' ? ' pos' : ''}`}>{item.type === 'INCOME' ? '+' : '−'}{money(item.amount)}</span>
      </button>)}
    </section>;
  })}</div>;
}

export function Loading({ label = 'Загружаем…' }: { label?: string }) {
  return <div className="loading" role="status"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function ErrorState({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return <section className="panel error-state" role="alert">
    <Icon name="info" /><div><b>Не получилось загрузить данные</b><p>{text}</p></div>
    {onRetry && <button type="button" className="btn line" onClick={onRetry}>Повторить</button>}
  </section>;
}

/** A button that asks again in place instead of a browser confirm(). */
export function ConfirmButton({ label, confirmLabel, onConfirm, className = 'btn danger', disabled }: {
  label: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
  disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const timer = window.setTimeout(() => setAsking(false), 5000);
    return () => window.clearTimeout(timer);
  }, [asking]);
  return <button type="button" className={`${className}${asking ? ' asking' : ''}`} disabled={disabled}
    onClick={() => { if (asking) { setAsking(false); void onConfirm(); } else setAsking(true); }}>
    {asking ? confirmLabel : label}
  </button>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function AmountInput({ value, onChange, label, autoFocus = true }: { value: string; onChange: (value: string) => void; label: string; autoFocus?: boolean }) {
  return <label className="amount">
    <input value={value} onChange={(event) => onChange(event.target.value.replace(/[^\d.,\s]/g, ''))}
      inputMode="decimal" placeholder="0" aria-label={label} autoComplete="off" {...(autoFocus ? { 'data-autofocus': true } : {})} />
    <span>₽</span>
  </label>;
}

export function Track({ percent, tone, marker }: { percent: number; tone?: 'near' | 'over' | 'pos'; marker?: number }) {
  return <div className={`track${tone ? ` ${tone}` : ''}`}>
    <i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    {marker != null && <u style={{ left: `${Math.max(0, Math.min(100, marker))}%` }} />}
  </div>;
}

