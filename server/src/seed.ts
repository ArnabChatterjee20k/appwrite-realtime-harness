import { services, isAlreadyExists } from './appwrite.js';
import { env } from './env.js';
import { TablesDBIndexType } from 'node-appwrite';

type SeedLog = (line: string) => void;

const COLUMNS = [
  { kind: 'text', key: 'name', required: true },
  { kind: 'enum', key: 'priority', elements: ['low', 'medium', 'high'] as string[], required: true },
  { kind: 'text', key: 'userId', required: true },
  { kind: 'text', key: 'message', required: false },
  { kind: 'datetime', key: 'createdAt', required: true },
] as const;

const INDEXES = [
  { key: 'idx_priority', type: TablesDBIndexType.Key, columns: ['priority'] },
  { key: 'idx_userId', type: TablesDBIndexType.Key, columns: ['userId'] },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runSeed(log: SeedLog = (l) => console.log(l)) {
  const { tablesDB } = services();
  const { databaseId, tableId } = env;

  log(`→ ensuring database "${databaseId}"`);
  try {
    await tablesDB.create({ databaseId, name: 'Realtime Harness' });
    log(`  created`);
  } catch (err) {
    if (!isAlreadyExists(err)) throw err;
    log(`  already exists`);
  }

  log(`→ ensuring table "${tableId}"`);
  try {
    await tablesDB.createTable({
      databaseId,
      tableId,
      name: 'notifications',
      rowSecurity: false,
      permissions: ['read("any")', 'create("any")', 'update("any")', 'delete("any")'],
    });
    log(`  created`);
  } catch (err) {
    if (!isAlreadyExists(err)) throw err;
    log(`  already exists`);
  }

  for (const col of COLUMNS) {
    log(`→ ensuring column "${col.key}" (${col.kind})`);
    try {
      if (col.kind === 'text') {
        await tablesDB.createTextColumn({ databaseId, tableId, key: col.key, required: col.required });
      } else if (col.kind === 'enum') {
        await tablesDB.createEnumColumn({ databaseId, tableId, key: col.key, elements: col.elements as string[], required: col.required });
      } else if (col.kind === 'datetime') {
        await tablesDB.createDatetimeColumn({ databaseId, tableId, key: col.key, required: col.required });
      }
      log(`  created`);
    } catch (err) {
      if (!isAlreadyExists(err)) throw err;
      log(`  already exists`);
    }
    await sleep(350);
  }

  log(`→ waiting for columns to be "available"`);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const table = await tablesDB.getTable({ databaseId, tableId });
    const cols = (table as any).columns ?? [];
    const pending = cols.filter((c: any) => c.status !== 'available');
    if (pending.length === 0) {
      log(`  all ${cols.length} columns available`);
      break;
    }
    log(`  waiting on: ${pending.map((c: any) => `${c.key}=${c.status}`).join(', ')}`);
    await sleep(800);
  }

  // for (const idx of INDEXES) {
  //   log(`→ ensuring index "${idx.key}"`);
  //   try {
  //     await tablesDB.createIndex({ databaseId, tableId, key: idx.key, type: idx.type, columns: idx.columns });
  //     log(`  created`);
  //   } catch (err) {
  //     if (!isAlreadyExists(err)) throw err;
  //     log(`  already exists`);
  //   }
  //   await sleep(200);
  // }

  log(`✓ seed complete`);
  return { databaseId, tableId, columns: COLUMNS.map((c) => c.key), indexes: INDEXES.map((i) => i.key) };
}
