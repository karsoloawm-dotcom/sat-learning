import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './ui/App';
import { store, replaceProject } from './app';
import { autosave, loadAutosave } from './state/persistence';

loadAutosave().then((p) => {
  if (p && !new URLSearchParams(location.search).has('demo')) replaceProject(p);
  store.subscribe((next) => autosave(next));
  createRoot(document.getElementById('root')!).render(<App />);
});
