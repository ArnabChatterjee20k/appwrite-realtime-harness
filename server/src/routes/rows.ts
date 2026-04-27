import { Router } from 'express';
import { z } from 'zod';
import { ID, Query } from 'node-appwrite';
import { services } from '../appwrite.js';
import { env } from '../env.js';

export const rowsRouter = Router();

const priorityEnum = z.enum(['low', 'medium', 'high']);

const createBody = z.object({
  name: z.string().min(1).max(255).optional(),
  priority: priorityEnum.optional(),
  userId: z.string().min(1).max(64).optional(),
  message: z.string().max(2048).optional(),
  rowId: z.string().optional(),
});

function fillRow(partial: z.infer<typeof createBody>) {
  const now = new Date().toISOString();
  const rowId = partial.rowId ?? ID.unique();
  return {
    rowId,
    data: {
      name: partial.name ?? `note-${rowId.slice(-6)}`,
      priority: partial.priority ?? 'low',
      userId: partial.userId ?? 'system',
      message: partial.message ?? `auto @ ${now}`,
      createdAt: now,
    },
  };
}

rowsRouter.post('/rows', async (req, res) => {
  const parse = createBody.safeParse(req.body ?? {});
  if (!parse.success) return res.status(400).json({ error: 'invalid body', issues: parse.error.issues });
  const { tablesDB } = services();
  try {
    const { rowId, data } = fillRow(parse.data);
    const row = await tablesDB.createRow({ databaseId: env.databaseId, tableId: env.tableId, rowId, data });
    res.json({ ok: true, row });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err), code: err?.code });
  }
});

const bulkBody = z.object({
  count: z.number().int().min(1).max(200),
  template: createBody.optional(),
});

rowsRouter.post('/rows/bulk', async (req, res) => {
  const parse = bulkBody.safeParse(req.body ?? {});
  if (!parse.success) return res.status(400).json({ error: 'invalid body', issues: parse.error.issues });
  const { tablesDB } = services();
  const { count, template } = parse.data;
  try {
    const started = Date.now();
    const rows = await Promise.all(
      Array.from({ length: count }).map(() => {
        const { rowId, data } = fillRow(template ?? {});
        return tablesDB.createRow({ databaseId: env.databaseId, tableId: env.tableId, rowId, data });
      }),
    );
    res.json({ ok: true, count: rows.length, ms: Date.now() - started });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err), code: err?.code });
  }
});

const patchBody = z.object({
  name: z.string().optional(),
  priority: priorityEnum.optional(),
  userId: z.string().optional(),
  message: z.string().optional(),
});

rowsRouter.patch('/rows/:rowId', async (req, res) => {
  const parse = patchBody.safeParse(req.body ?? {});
  if (!parse.success) return res.status(400).json({ error: 'invalid body', issues: parse.error.issues });
  const { tablesDB } = services();
  try {
    const row = await tablesDB.updateRow({
      databaseId: env.databaseId,
      tableId: env.tableId,
      rowId: req.params.rowId,
      data: parse.data,
    });
    res.json({ ok: true, row });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err), code: err?.code });
  }
});

rowsRouter.delete('/rows/:rowId', async (req, res) => {
  const { tablesDB } = services();
  try {
    await tablesDB.deleteRow({ databaseId: env.databaseId, tableId: env.tableId, rowId: req.params.rowId });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err), code: err?.code });
  }
});

rowsRouter.post('/rows/reset', async (_req, res) => {
  const { tablesDB } = services();
  let removed = 0;
  try {
    // paginate through rows and delete
    for (let i = 0; i < 50; i++) {
      const page: any = await tablesDB.listRows({
        databaseId: env.databaseId,
        tableId: env.tableId,
        queries: [Query.limit(100)],
      });
      const rows: any[] = page.rows ?? page.documents ?? [];
      if (rows.length === 0) break;
      for (const r of rows) {
        try {
          await tablesDB.deleteRow({ databaseId: env.databaseId, tableId: env.tableId, rowId: r.$id });
          removed++;
        } catch {}
      }
    }
    res.json({ ok: true, removed });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err), code: err?.code, removed });
  }
});

rowsRouter.get('/rows', async (_req, res) => {
  const { tablesDB } = services();
  try {
    const page: any = await tablesDB.listRows({
      databaseId: env.databaseId,
      tableId: env.tableId,
      queries: [Query.limit(50)],
    });
    res.json({ total: page.total, rows: page.rows ?? page.documents ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err), code: err?.code });
  }
});
