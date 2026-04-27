import { Client, Realtime, TablesDB, type RealtimeResponseEvent, type RealtimeSubscription } from 'appwrite';

export type SocketState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export type SimulatedUser = {
  userId: string;
  name: string;
  email: string;
  client: Client;
  realtime: Realtime;
  tablesDB: TablesDB;
  socketState: SocketState;
  subscriptions: Map<string, ActiveSubscription>;
  eventCount: number;
  errorCount: number;
  lastError?: string;
};

export type ActiveSubscription = {
  id: string;
  channels: string[];
  queries: string[];
  presetLabel: string;
  handle: RealtimeSubscription;
  openedAt: number;
  closedAt?: number;
  eventCount: number;
  lastEvent?: RealtimeResponseEvent<any>;
  serverIds: Set<string>;
  ghostEvents: number;
};

export type EventRecord = {
  id: string;
  simulatedUserId: string;
  subscriptionSlotId: string;
  timestamp: number;
  events: string[];
  channels: string[];
  subscriptions: string[];
  payload: any;
};

export type SpawnArgs = {
  endpoint: string;
  projectId: string;
  sessionSecret: string;
  userId: string;
  name: string;
  email: string;
  onSocketState: (s: SocketState) => void;
  onError: (message: string) => void;
};

export function spawnSimulatedUser(args: SpawnArgs): SimulatedUser {
  const client = new Client().setEndpoint(args.endpoint).setProject(args.projectId);
  // Per-Client session — read by the Realtime handshake before falling back to localStorage
  // (examples/web/src/client.ts:722-734). This gives each simulated user its own WebSocket + identity
  // in a single browser tab.
  (client as any).config.session = args.sessionSecret;

  const realtime = new Realtime(client);
  const tablesDB = new TablesDB(client);

  realtime.onOpen(() => args.onSocketState('open'));
  realtime.onClose(() => args.onSocketState('closed'));
  realtime.onError((err) => {
    args.onSocketState('error');
    args.onError(err?.message ?? 'realtime error');
  });

  return {
    userId: args.userId,
    name: args.name,
    email: args.email,
    client,
    realtime,
    tablesDB,
    socketState: 'idle',
    subscriptions: new Map(),
    eventCount: 0,
    errorCount: 0,
  };
}

/**
 * Force-close the underlying WebSocket to exercise reconnect logic.
 * The Realtime class will detect the close and schedule a reconnect.
 */
export function forceReconnect(user: SimulatedUser) {
  const anyRt = user.realtime as any;
  const socket: WebSocket | undefined = anyRt.socket;
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close(4001, 'forced reconnect test');
  }
}

export function socketReadyState(user: SimulatedUser): SocketState {
  const socket: WebSocket | undefined = (user.realtime as any).socket;
  if (!socket) return 'idle';
  switch (socket.readyState) {
    case WebSocket.CONNECTING:
      return 'connecting';
    case WebSocket.OPEN:
      return 'open';
    case WebSocket.CLOSING:
    case WebSocket.CLOSED:
      return 'closed';
    default:
      return 'idle';
  }
}
