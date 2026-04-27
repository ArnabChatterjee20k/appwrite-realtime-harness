import { Client, TablesDB, Users } from 'node-appwrite';
import { env } from './env.js';

export function makeClient(): Client {
  return new Client()
    .setEndpoint(env.endpoint)
    .setProject(env.projectId)
    .setKey(env.apiKey);
}

export function services() {
  const client = makeClient();
  return {
    client,
    tablesDB: new TablesDB(client),
    users: new Users(client),
  };
}

export function isAlreadyExists(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: number; type?: string };
  return e.code === 409 || (typeof e.type === 'string' && e.type.endsWith('_already_exists'));
}
