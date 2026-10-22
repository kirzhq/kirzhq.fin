import { useState } from 'react';
import type { ReactNode } from 'react';
import { effectiveTheme, saveTheme } from '../theme';
import { useFinance } from '../store';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export type View = 'overview' | 'ops' | 'debts' | 'goals' | 'car' | 'settings' | 'more';

export const VIEWS: Array<{ id: Exclude<View, 'more'>; title: string; icon: IconName }> = [
  { id: 'overview', title: 'Обзор', icon: 'pie' },
  { id: 'ops', title: 'Операции', icon: 'list' },
  { id: 'debts', title: 'Долги', icon: 'card' },
  { id: 'goals', title: 'Накопления', icon: 'goal' },
  { id: 'car', title: 'Автомобиль', icon: 'car' },
  { id: 'settings', title: 'Настройки', icon: 'gear' },
];

const HOME = 'https://home.kirzhq.ru';

export function ThemeToggle({ className, withLabel = false }: { className: string; withLabel?: boolean }) {
  const [theme, setTheme] = useState(effectiveTheme);
  const next = theme === 'dark' ? 'light' : 'dark';
  return <button type="button" className={className} onClick={() => { saveTheme(next); setTheme(next); }}
    aria-label={next === 'dark' ? 'Включить тёмную тему' : 'Включить светлую тему'}>
    <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    {withLabel && <span>{next === 'dark' ? 'Тёмная тема' : 'Светлая тема'}</span>}
  </button>;
}

export function Shell({ view, children }: { view: View; children: ReactNode }) {
  const { openOperation } = useFinance();
  const inMore = view === 'goals' || view === 'car' || view === 'settings' || view === 'more';
  return <div className="app">
    <aside className="side" aria-label="Разделы">
      <a className="brand" href={HOME}><span className="mark">МД</span>Мой дом</a>
      <nav className="nav" aria-label="Основное">
        <a href={HOME}><Icon name="home" />Сегодня</a>
        <a href={`${HOME}/#calendar`}><Icon name="calendar" />Календарь</a>
        <a href={`${HOME}/#notes`}><Icon name="note" />Заметки</a>
        <a href={`${HOME}/learn/`}><Icon name="learn" />Учёба</a>
        <div className="nav-label">Сервисы</div>
        <a href="#overview" className="open"><Icon name="wallet" />Финансы<span className="dot fin" /></a>
        <div className="sub">
          {VIEWS.map((item) => <a key={item.id} href={`#${item.id}`} aria-current={view === item.id ? 'page' : undefined}>{item.title}</a>)}
        </div>
        <a href="https://mail.kirzhq.ru" target="_blank" rel="noopener"><Icon name="mail" />Почта<Icon name="ext" className="ext" /></a>
      </nav>
      <div className="side-foot">
        <button type="button" onClick={() => openOperation()}><Icon name="plus" />Новая операция</button>
        <ThemeToggle className="side-btn" withLabel />
      </div>
    </aside>
    <main className="main" id="main"><div className="wrap">{children}</div></main>
    <nav className="tabbar" aria-label="Разделы финансов">
      <a href="#overview" aria-current={view === 'overview' ? 'page' : undefined}><Icon name="pie" />Обзор</a>
      <a href="#ops" aria-current={view === 'ops' ? 'page' : undefined}><Icon name="list" />Операции</a>
      <button type="button" className="plus" onClick={() => openOperation()} aria-label="Новая операция"><span><Icon name="plus" /></span></button>
      <a href="#debts" aria-current={view === 'debts' ? 'page' : undefined}><Icon name="card" />Долги</a>
      <a href="#more" aria-current={inMore ? 'page' : undefined}><Icon name="more" />Ещё</a>
    </nav>
  </div>;
}
