import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export const env = {
  endpoint: required('APPWRITE_ENDPOINT'),
  projectId: required('APPWRITE_PROJECT_ID'),
  apiKey: required('APPWRITE_API_KEY'),
  databaseId: process.env.APPWRITE_DATABASE_ID ?? 'realtime_harness',
  tableId: process.env.APPWRITE_TABLE_ID ?? 'notifications',
  serverPort: Number(process.env.SERVER_PORT ?? 8787),
  webPort: Number(process.env.WEB_PORT ?? 5173),
};
