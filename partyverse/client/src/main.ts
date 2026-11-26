import { settings } from './core/Settings';
import { App } from './app/App';

const boot = (p: number, msg: string) => {
  const bar = document.getElementById('boot-bar');
  const m = document.getElementById('boot-msg');
  if (bar) bar.style.width = `${Math.round(p * 40)}%`;
  if (m) m.textContent = msg;
};

const app = new App(document.getElementById('game')!, document.getElementById('ui')!);
(window as unknown as { pv: App }).pv = app; // acesso para testes automatizados
(window as unknown as { pvSettings: typeof settings }).pvSettings = settings;
app.start(boot).catch((e) => {
  console.error(e);
  boot(0, 'Erro ao iniciar. Recarregue a página.');
});
