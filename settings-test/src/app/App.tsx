/**
 * Your App - Edit this file!
 *
 * This is where you build your UI.
 * Use the ekka client for all data operations.
 */

import { ekka } from '../ekka';

export function App() {
  // Example: Initialize on button click
  async function handleStart() {
    await ekka.connect();
    // Now you can use ekka.db and ekka.queue
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>My EKKA App</h1>
      <p>Edit <code>src/app/App.tsx</code> to get started.</p>
      <button onClick={handleStart}>Start</button>
    </div>
  );
}
