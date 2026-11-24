import { useEffect, useState } from 'react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const standalone = window.matchMedia('(display-mode: standalone)');

export function useInstallState() {
  const [installed, setInstalled] = useState(standalone.matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    function deferPrompt(event: Event) {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    }
    function installedApp() {
      setInstalled(true);
      setPrompt(null);
    }
    function displayChanged() {
      if (standalone.matches) installedApp();
    }
    window.addEventListener('beforeinstallprompt', deferPrompt);
    window.addEventListener('appinstalled', installedApp);
    standalone.addEventListener('change', displayChanged);
    return () => {
      window.removeEventListener('beforeinstallprompt', deferPrompt);
      window.removeEventListener('appinstalled', installedApp);
      standalone.removeEventListener('change', displayChanged);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    setPrompt(null);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      // The browser may withdraw a pending prompt. The menu instructions remain available.
    }
  }

  return { installed, canPrompt: Boolean(prompt), install };
}

export function InstallPanel({ state }: { state: ReturnType<typeof useInstallState> }) {
  if (state.installed) return null;

  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const macSafari = /Macintosh/.test(navigator.userAgent) && /Version\/.*Safari\//.test(navigator.userAgent);
  return <section className="panel">
    <div className="panel-h"><h2>Установка приложения</h2></div>
    {window.top !== window.self
      ? <a className="btn line" href="/#settings" target="_top">Открыть «Финансы» для установки</a>
      : state.canPrompt
        ? <button className="btn line" type="button" onClick={() => void state.install()}>Установить «Финансы»</button>
        : <p className="muted small">{ios
          ? 'В Safari нажмите «Поделиться» → «На экран Домой» → «Добавить».'
          : macSafari
            ? 'В Safari откройте меню «Файл» и выберите «Добавить в Dock».'
            : 'Откройте меню браузера и выберите установку приложения. Эта функция доступна в Chrome и Edge.'}</p>}
  </section>;
}
