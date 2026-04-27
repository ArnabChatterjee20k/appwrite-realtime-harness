import { create } from 'zustand';
import { ID, type RealtimeResponseEvent } from 'appwrite';
import { api, type ConfigResponse } from '../lib/api';
import {
  addSlot,
  dropUser,
  getAllSlots,
  getAllUsers,
  getSlot,
  getUser,
  markSlotClosed,
  markSlotEvent,
  patchSlot,
  registerUser,
  removeSlot,
} from './registry';
import {
  forceReconnect as forceReconnectImpl,
  socketReadyState,
  type SocketState,
} from '../sdk/simulatedUser';
import { buildSubscription, type ChannelPreset } from '../sdk/channels';

const MAX_EVENTS = 500;

export type UserView = {
  id: string;
  name: string;
  email: string;
  socketState: SocketState;
  eventCount: number;
  errorCount: number;
  lastError?: string;
  subs: SubView[];
};

export type SubView = {
  id: string;
  channels: string[];
  queries: string[];
  presetLabel: string;
  openedAt: number;
  closedAt?: number;
  eventCount: number;
  serverIds: string[];
  ghostEvents: number;
};

export type EventRow = {
  id: string;
  timestamp: number;
  simulatedUserId: string;
  slotId: string;
  events: string[];
  channels: string[];
  subscriptions: string[];
  payload: any;
};

export type ProbeLog = {
  id: string;
  name: string;
  startedAt: number;
  finishedAt?: number;
  ok?: boolean;
  detail?: string;
};

type Store = {
  config?: ConfigResponse;
  configError?: string;
  users: UserView[];
  events: EventRow[];
  probes: ProbeLog[];
  seedLog: string[];
  seedRunning: boolean;
  activeUserId?: string;
  feedPaused: boolean;

  loadConfig: () => Promise<void>;
  seed: () => Promise<void>;
  resetRows: () => Promise<void>;
  addUser: (name?: string) => Promise<void>;
  rehydrateUsers: () => Promise<void>;
  removeUser: (id: string) => Promise<void>;
  purgeUsers: () => Promise<void>;
  setActiveUser: (id: string | undefined) => void;

  subscribe: (userId: string, preset: ChannelPreset) => Promise<void>;
  unsubscribe: (userId: string, slotId: string) => Promise<void>;
  updateSubscription: (userId: string, slotId: string, preset: ChannelPreset) => Promise<void>;
  closeSubscription: (userId: string, slotId: string) => Promise<void>;
  resubscribe: (userId: string, slotId: string) => Promise<void>;
  forceReconnect: (userId: string) => void;

  refresh: () => void;
  recordProbe: (p: ProbeLog) => void;
  updateProbe: (id: string, patch: Partial<ProbeLog>) => void;
  recordEvent: (evt: EventRow) => void;
  clearEvents: () => void;
  setFeedPaused: (v: boolean) => void;
};

function registerSimulatedUser(
  remote: { userId: string; name: string; email: string; sessionSecret: string },
  config: ConfigResponse,
  get: () => Store,
) {
  const handleEvent = (slotId: string) => (evt: RealtimeResponseEvent<any>) => {
    markSlotEvent(slotId, evt);
    const u = getUser(remote.userId);
    if (u) u.eventCount++;
    get().recordEvent({
      id: ID.unique(),
      timestamp: Date.now(),
      simulatedUserId: remote.userId,
      slotId,
      events: evt.events,
      channels: evt.channels,
      subscriptions: evt.subscriptions ?? [],
      payload: evt.payload,
    });
    get().refresh();
  };

  const user = registerUser({
    endpoint: config.endpoint,
    projectId: config.projectId,
    sessionSecret: remote.sessionSecret,
    userId: remote.userId,
    name: remote.name,
    email: remote.email,
    onSocketState: () => get().refresh(),
    onError: (msg) => {
      const u = getUser(remote.userId);
      if (u) {
        u.errorCount++;
        u.lastError = msg;
      }
      get().refresh();
    },
  });
  (user as any).__handleEventFactory = handleEvent;
}

function snapshotUsers(): UserView[] {
  return getAllUsers().map((u) => ({
    id: u.userId,
    name: u.name,
    email: u.email,
    socketState: socketReadyState(u),
    eventCount: u.eventCount,
    errorCount: u.errorCount,
    lastError: u.lastError,
    subs: getAllSlots()
      .filter((s) => s.simulatedUserId === u.userId)
      .map((s) => ({
        id: s.id,
        channels: s.channels,
        queries: s.queries,
        presetLabel: s.presetLabel,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        eventCount: s.eventCount,
        serverIds: Array.from(s.serverIds),
        ghostEvents: s.ghostEvents,
      })),
  }));
}

export const useStore = create<Store>((set, get) => ({
  users: [],
  events: [],
  probes: [],
  seedLog: [],
  seedRunning: false,
  feedPaused: false,

  loadConfig: async () => {
    try {
      const config = await api.config();
      set({ config, configError: undefined });
    } catch (e: any) {
      set({ configError: e?.message ?? String(e) });
    }
  },

  seed: async () => {
    set({ seedRunning: true, seedLog: [] });
    try {
      const res = await api.seed();
      set({ seedLog: res.log, seedRunning: false });
    } catch (e: any) {
      set({ seedLog: [`error: ${e?.message ?? String(e)}`], seedRunning: false });
    }
  },

  resetRows: async () => {
    await api.resetRows();
  },

  addUser: async (name) => {
    const config = get().config;
    if (!config) throw new Error('config not loaded');
    const remote = await api.createUser(name);
    registerSimulatedUser(remote, config, get);
    set({ activeUserId: remote.userId });
    get().refresh();
  },

  rehydrateUsers: async () => {
    const config = get().config;
    if (!config) return;
    try {
      const res = await api.rehydrateUsers();
      for (const remote of res.users) {
        if (getUser(remote.userId)) continue;
        registerSimulatedUser(remote, config, get);
      }
      if (!get().activeUserId) {
        const first = getAllUsers()[0]?.userId;
        if (first) set({ activeUserId: first });
      }
      get().refresh();
    } catch {
      // rehydrate is best-effort; server may not be up yet
    }
  },

  removeUser: async (id) => {
    dropUser(id);
    try {
      await api.deleteUser(id);
    } catch {
      /* ignore — user may already be gone */
    }
    if (get().activeUserId === id) {
      const next = getAllUsers()[0]?.userId;
      set({ activeUserId: next });
    }
    get().refresh();
  },

  purgeUsers: async () => {
    for (const u of getAllUsers()) dropUser(u.userId);
    await api.purgeUsers().catch(() => {});
    set({ activeUserId: undefined });
    get().refresh();
  },

  setActiveUser: (id) => set({ activeUserId: id }),

  subscribe: async (userId, preset) => {
    const user = getUser(userId);
    const config = get().config;
    if (!user || !config) return;
    const built = buildSubscription(preset, config.databaseId, config.tableId);
    const slotId = ID.unique();
    const factory = (user as any).__handleEventFactory as (slotId: string) => (e: RealtimeResponseEvent<any>) => void;
    const handle = await user.realtime.subscribe(built.channels as any, factory(slotId), built.queries);
    addSlot({
      id: slotId,
      simulatedUserId: userId,
      channels: built.displayChannels,
      queries: built.displayQueries,
      presetLabel: preset.label + (preset.id === 'row-specific' ? ` (${(preset as any).rowId})` : ''),
      preset,
      openedAt: Date.now(),
      eventCount: 0,
      serverIds: new Set(),
      ghostEvents: 0,
      handle,
    });
    get().refresh();
  },

  unsubscribe: async (_userId, slotId) => {
    const slot = getSlot(slotId);
    if (!slot) return;
    await slot.handle.unsubscribe();
    markSlotClosed(slotId);
    get().refresh();
  },

  updateSubscription: async (_userId, slotId, preset) => {
    const slot = getSlot(slotId);
    const config = get().config;
    if (!slot || !config) return;
    const built = buildSubscription(preset, config.databaseId, config.tableId);
    await slot.handle.update({
      channels: built.channels as any,
      queries: built.queries,
    });
    patchSlot(slotId, {
      channels: built.displayChannels,
      queries: built.displayQueries,
      presetLabel:
        preset.label + (preset.id === 'row-specific' ? ` (${(preset as any).rowId})` : ''),
      preset,
    });
    get().refresh();
  },

  closeSubscription: async (_userId, slotId) => {
    const slot = getSlot(slotId);
    if (!slot) return;
    await slot.handle.close();
    markSlotClosed(slotId);
    get().refresh();
  },

  resubscribe: async (userId, slotId) => {
    const slot = getSlot(slotId);
    if (!slot) return;
    const preset = slot.preset;
    removeSlot(slotId);
    get().refresh();
    await get().subscribe(userId, preset);
  },

  forceReconnect: (userId) => {
    const user = getUser(userId);
    if (user) forceReconnectImpl(user);
  },

  refresh: () => set({ users: snapshotUsers() }),

  recordProbe: (p) => set((s) => ({ probes: [p, ...s.probes].slice(0, 100) })),
  updateProbe: (id, patch) =>
    set((s) => ({ probes: s.probes.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

  recordEvent: (evt) =>
    set((s) => (s.feedPaused ? s : { events: [evt, ...s.events].slice(0, MAX_EVENTS) })),

  clearEvents: () => set({ events: [] }),
  setFeedPaused: (v) => set({ feedPaused: v }),
}));

// Stable color per userId — derived from a short hash.
const USER_COLOR_PALETTE = [
  '#60a5fa', // blue-400
  '#f472b6', // pink-400
  '#34d399', // emerald-400
  '#fbbf24', // amber-400
  '#a78bfa', // violet-400
  '#fb7185', // rose-400
  '#2dd4bf', // teal-400
  '#fb923c', // orange-400
];

export function userColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return USER_COLOR_PALETTE[h % USER_COLOR_PALETTE.length];
}
