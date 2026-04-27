import { Router } from 'express';
import { z } from 'zod';
import { ID } from 'node-appwrite';
import { services } from '../appwrite.js';

export const usersRouter = Router();

const createBody = z.object({
  name: z.string().max(128).optional(),
});

const HARNESS_LABEL = 'harness';

usersRouter.post('/users', async (req, res) => {
  const parse = createBody.safeParse(req.body ?? {});
  if (!parse.success) return res.status(400).json({ error: 'invalid body', issues: parse.error.issues });

  const { users } = services();
  const userId = ID.unique();
  const email = `${userId}@harness.local`;
  const password = `H${userId}!aA1`;
  const name = parse.data.name ?? `user-${userId.slice(-6)}`;

  try {
    const user = await users.create({ userId, email, password, name });
    try {
      await users.updateLabels({ userId: user.$id, labels: [HARNESS_LABEL] });
    } catch {
      // labels optional; ignore if method shape differs
    }
    const session = await users.createSession({ userId: user.$id });
    res.json({
      userId: user.$id,
      email: user.email,
      name: user.name,
      sessionId: session.$id,
      sessionSecret: (session as any).secret,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err), code: err?.code });
  }
});

usersRouter.get('/users', async (_req, res) => {
  const { users } = services();
  try {
    const list = await users.list();
    const harness = ((list as any).users ?? []).filter((u: any) => (u.labels ?? []).includes(HARNESS_LABEL));
    res.json({ total: harness.length, users: harness.map((u: any) => ({ userId: u.$id, email: u.email, name: u.name })) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err), code: err?.code });
  }
});

usersRouter.delete('/users/:userId', async (req, res) => {
  const { users } = services();
  const userId = req.params.userId;
  try {
    try {
      await users.deleteSessions({ userId });
    } catch {
      // user might already have no sessions
    }
    await users.delete({ userId });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err), code: err?.code });
  }
});

usersRouter.post('/users/rehydrate', async (_req, res) => {
  const { users } = services();
  try {
    const list = await users.list();
    const harness = ((list as any).users ?? []).filter((u: any) => (u.labels ?? []).includes(HARNESS_LABEL));
    const rehydrated: Array<{ userId: string; email: string; name: string; sessionId: string; sessionSecret: string }> = [];
    for (const u of harness) {
      try {
        const session = await users.createSession({ userId: u.$id });
        rehydrated.push({
          userId: u.$id,
          email: u.email,
          name: u.name,
          sessionId: session.$id,
          sessionSecret: (session as any).secret,
        });
      } catch {
        // skip users we can't mint a session for
      }
    }
    res.json({ total: rehydrated.length, users: rehydrated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err), code: err?.code });
  }
});

usersRouter.post('/users/purge', async (_req, res) => {
  const { users } = services();
  try {
    const list = await users.list();
    const targets = ((list as any).users ?? []).filter((u: any) => (u.labels ?? []).includes(HARNESS_LABEL));
    let removed = 0;
    for (const u of targets) {
      try {
        await users.deleteSessions({ userId: u.$id });
      } catch {}
      try {
        await users.delete({ userId: u.$id });
        removed++;
      } catch {}
    }
    res.json({ ok: true, removed });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err), code: err?.code });
  }
});
