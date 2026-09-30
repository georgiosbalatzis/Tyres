import './styles/tokens.css';
import './styles/app.css';
import { start } from './ui/app.ts';

void start().catch((err) => {
  // The prerendered page stays fully readable; only interactivity is lost.
  console.error('Tyre Intelligence failed to start:', err);
});
