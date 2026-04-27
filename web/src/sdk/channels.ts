import { Channel, Query } from 'appwrite';

export type ChannelPreset =
  | { id: 'all-rows'; label: string }
  | { id: 'creates'; label: string }
  | { id: 'updates'; label: string }
  | { id: 'deletes'; label: string }
  | { id: 'row-specific'; label: string; rowId: string }
  | { id: 'priority-high'; label: string }
  | { id: 'priority-medium'; label: string }
  | { id: 'priority-low'; label: string }
  | { id: 'by-user'; label: string; userId: string }
  | { id: 'custom'; label: string; raw: string; queries?: string[] };

export function rowChannel(databaseId: string, tableId: string): string {
  return Channel.tablesdb(databaseId).table(tableId).row().toString();
}

export type BuiltSubscription = {
  channels: (string | ReturnType<typeof Channel.tablesdb>)[];
  queries: string[];
  displayChannels: string[];
  displayQueries: string[];
};

export function buildSubscription(
  preset: ChannelPreset,
  databaseId: string,
  tableId: string,
): BuiltSubscription {
  const table = Channel.tablesdb(databaseId).table(tableId);
  const row = table.row();

  switch (preset.id) {
    case 'all-rows': {
      const c = row.toString();
      return { channels: [c], queries: [], displayChannels: [c], displayQueries: [] };
    }
    case 'creates': {
      const c = row.create().toString();
      return { channels: [c], queries: [], displayChannels: [c], displayQueries: [] };
    }
    case 'updates': {
      const c = row.update().toString();
      return { channels: [c], queries: [], displayChannels: [c], displayQueries: [] };
    }
    case 'deletes': {
      const c = row.delete().toString();
      return { channels: [c], queries: [], displayChannels: [c], displayQueries: [] };
    }
    case 'row-specific': {
      const c = table.row(preset.rowId).toString();
      return { channels: [c], queries: [], displayChannels: [c], displayQueries: [] };
    }
    case 'priority-high': {
      const c = row.toString();
      const q = Query.equal('priority', 'high');
      return { channels: [c], queries: [q], displayChannels: [c], displayQueries: [q] };
    }
    case 'priority-medium': {
      const c = row.toString();
      const q = Query.equal('priority', 'medium');
      return { channels: [c], queries: [q], displayChannels: [c], displayQueries: [q] };
    }
    case 'priority-low': {
      const c = row.toString();
      const q = Query.equal('priority', 'low');
      return { channels: [c], queries: [q], displayChannels: [c], displayQueries: [q] };
    }
    case 'by-user': {
      const c = row.toString();
      const q = Query.equal('userId', preset.userId);
      return { channels: [c], queries: [q], displayChannels: [c], displayQueries: [q] };
    }
    case 'custom': {
      const queries = (preset.queries ?? []).map((q) => q.trim()).filter(Boolean);
      return {
        channels: [preset.raw],
        queries,
        displayChannels: [preset.raw],
        displayQueries: queries,
      };
    }
  }
}
