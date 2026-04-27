import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { healthRouter } from './routes/health.js';
import { usersRouter } from './routes/users.js';
import { rowsRouter } from './routes/rows.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.use('/api', healthRouter);
app.use('/api', usersRouter);
app.use('/api', rowsRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: err?.message ?? 'unknown error' });
});

app.listen(env.serverPort, () => {
  console.log(`[harness] server listening on :${env.serverPort}`);
  console.log(`[harness] endpoint=${env.endpoint} project=${env.projectId} db=${env.databaseId} table=${env.tableId}`);
});
