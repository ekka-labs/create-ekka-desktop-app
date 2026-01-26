# src/ekka - DO NOT EDIT

**This directory is managed by EKKA. Do not modify these files.**

## What This Is

This is the EKKA plumbing layer. It provides a single API for your TypeScript UI.

## How It Works

Everything runs in memory. No setup required. No network calls.

```typescript
import { ekka } from './ekka';

// Initialize (instant, no network)
await ekka.connect();

// Use the db API
await ekka.db.put('my-key', { some: 'value' });
const data = await ekka.db.get('my-key');

// Use the queue API
await ekka.queue.enqueue('email', { to: 'user@example.com' });
const job = await ekka.queue.claim();
if (job) {
  // process job...
  await ekka.queue.ack(job);
}
```

## Security Model

Your TypeScript code is **sandboxed**. It:

- MUST NOT read files
- MUST NOT make direct network calls
- MUST NOT decide config
- MUST NOT do crypto
- MUST NOT persist tokens

ESLint guardrails enforce these rules.

## Files

| File | Purpose |
|------|---------|
| `demo-backend.ts` | In-memory db and queue implementation |
| `client.ts` | Connection management |
| `api.ts` | db and queue API wrappers |
| `session.ts` | Session state |
| `errors.ts` | Error types |
| `index.ts` | Main export (`ekka` object) |

## Data Persistence

Data is stored in memory only. It will be cleared when you:
- Refresh the page
- Close the browser tab
- Call `ekka.disconnect()`

---

*Do not edit. Managed by EKKA.*
