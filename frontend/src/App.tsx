import { useEffect, useState } from 'react';
import { Icon } from './components/Icon';
import { Shell, ThemeToggle, VIEWS } from './components/Shell';
import type { View } from './components/Shell';
import { PageHead } from './components/ui';
import { FinanceProvider, useFinance } from './store';
import { Car } from './views/Car';
import { Debts } from './views/Debts';
import { Goals } from './views/Goals';
import { OperationSheet } from './views/OperationSheet';
import { Operations } from './views/Operations';
import { Overview } from './views/Overview';
import { Settings } from './views/Settings';

const KNOWN: View[] = ['overview', 'ops', 'debts', 'goals', 'car', 'settings', 'more'];
const TITLES: Record<View, string> = { overview: 'Обзор', ops: 'Операции', debts: 'Долги', goals: 'Накопления', car: 'Автомобиль', settings: 'Настройки', more: 'Ещё' };

function viewFromHash(): View {
  const hash = window.location.hash.slice(1) as View;
  return KNOWN.includes(hash) ? hash : 'overview';
}

export default function App() {
  return <FinanceProvider><Screens /></FinanceProvider>;
}

function Screens() {
  const { draft, toasts } = useFinance();
  const [view, setView] = useState<View>(viewFromHash);
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => { setView(viewFromHash()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => { document.title = `${TITLES[view]} · Финансы`; }, [view]);

  return <Shell view={view}>
    {view === 'overview' && <Overview onCategory={(name) => { setCategory(name); window.location.hash = 'ops'; }} />}
    {view === 'ops' && <Operations category={category} setCategory={setCategory} />}
    {view === 'debts' && <Debts />}
    {view === 'goals' && <Goals />}
    {view === 'car' && <Car />}
    {view === 'settings' && <Settings />}
    {view === 'more' && <More />}
    {draft && <OperationSheet key={draft.operation?.id ?? 'new'} draft={draft} />}
    <div className="toasts" aria-live="polite">{toasts.map((item) => <div key={item.id} className={`toast${item.error ? ' error' : ''}`} role={item.error ? 'alert' : 'status'}>{item.text}</div>)}</div>
  </Shell>;
}

function More() {
  return <>
    <PageHead kicker="Финансы" title="Ещё" />
    <section className="panel"><div className="rows">
      {VIEWS.filter((item) => ['goals', 'car', 'settings'].includes(item.id)).map((item) =>
        <a key={item.id} className="row link-row" href={`#${item.id}`}><Icon name={item.icon} /><span className="grow">{item.title}</span><Icon name="right" /></a>)}
      <a className="row link-row" href="https://home.kirzhq.ru"><Icon name="home" /><span className="grow">Мой дом</span><Icon name="ext" /></a>
      <div className="row"><span className="grow">Тема оформления</span><ThemeToggle className="iconbtn" /></div>
    </div></section>
  </>;
}
