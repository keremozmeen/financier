import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { requestPersistentStorage } from './platform/persistence';

// Keep IndexedDB from being evicted under storage pressure (D1). Settings shows the result in Phase 7.
void requestPersistentStorage();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
