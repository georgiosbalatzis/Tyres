import './styles/tokens.css';
import './styles/shell.css';
import './styles/app.css';
import { start } from './ui/app.ts';

void start().catch((err) => {
  // The prerendered page stays fully readable; only interactivity is lost.
  console.error('TYRES failed to start:', err);
});
