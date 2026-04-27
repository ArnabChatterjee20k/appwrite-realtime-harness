# Realtime Test Harness

Fullstack tool for stress-testing Appwrite Realtime: multi-user simulation, manual subscription control, stress probes, and live idempotency assertions.

Consumes the locally-generated Appwrite SDKs from `../sdk-generator/examples/{web,node}` so it tests the SDK code you're currently working on.

## Setup

```bash
cp .env.example .env      # fill APPWRITE_ENDPOINT, PROJECT_ID, API_KEY
npm install               # installs workspaces + local SDK deps
npm run seed              # idempotent: creates database, table, columns, indexes
npm run dev               # server :8787 + web :5173
```

Open http://localhost:5173.

## What it does

- **User pool**: spawn N simulated users, each with its own WebSocket, via `Users.createSession` on the backend
- **Workbench**: per-user manual subscribe / unsubscribe / close / update with channel presets and queries
- **Probes**: rapid, late, sub-before-ack, churn, reconnect, duplicate, bulk
- **Assertions**: no ghost events, filter fidelity, subscription ID uniqueness + stability (idempotency)
- **Event feed**: global + per-user streams
- **Backend emitter**: fire row CRUD from Node so events originate server-side

## Layout

```
server/   Node + Express + TypeScript — seed, users, rows, config
web/      Vite + React + TypeScript + Tailwind — the UI
```

The Appwrite SDKs are consumed as source via aliases (Vite alias for web, tsconfig paths for server), so regenerating templates in `../sdk-generator` is picked up on next dev-server restart — no rebuild needed.
