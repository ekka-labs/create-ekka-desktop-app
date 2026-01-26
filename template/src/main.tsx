import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Toggle between DemoApp and App here:
// import { App } from './app/App';
import { DemoApp as App } from './demo/DemoApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
