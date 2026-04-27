import { Router } from 'express';
import { env } from '../env.js';
import { services } from '../appwrite.js';
import { runSeed } from '../seed.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ ok: true });
});

healthRouter.get('/config', (_req, res) => {
  res.json({
    endpoint: env.endpoint,
    projectId: env.projectId,
    databaseId: env.databaseId,
    tableId: env.tableId,
  });
});

healthRouter.post('/seed', async (_req, res) => {
  const lines: string[] = [];
  try {
    const summary = await runSeed((l) => {
      lines.push(l);
      console.log(l);
    });
    res.json({ ok: true, summary, log: lines });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message ?? String(err), log: lines });
  }
});

healthRouter.get('/appwrite-ping', async (_req, res) => {
  try {
    const { tablesDB } = services();
    await tablesDB.listTables({ databaseId: env.databaseId });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err?.message ?? String(err), code: err?.code });
  }
});
