import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { SessionSplash } from '../../src/components/auth/SessionSplash';

createRoot(document.getElementById('root')!).render(<StrictMode><SessionSplash /></StrictMode>);
