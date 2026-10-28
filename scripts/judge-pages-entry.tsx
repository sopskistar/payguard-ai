import { createRoot } from 'react-dom/client';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '../src/app/globals.css';
import { JudgeSandbox } from '../src/components/judge-sandbox';
createRoot(document.getElementById('judge-root')!).render(<JudgeSandbox />);
