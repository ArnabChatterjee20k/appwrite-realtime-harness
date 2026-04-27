import type { RealtimeSubscription, RealtimeResponseEvent } from 'appwrite';
import { spawnSimulatedUser, type SimulatedUser, type SpawnArgs } from '../sdk/simulatedUser';
import type { ChannelPreset } from '../sdk/channels';

export type SubSlot = {
  id: string;
  simulatedUserId: string;
  channels: string[];
  queries: string[];
  presetLabel: string;
  preset: ChannelPreset;
  openedAt: number;
  closedAt?: number;
  eventCount: number;
  serverIds: Set<string>;
  ghostEvents: number;
  handle: RealtimeSubscription;
};

const users = new Map<string, SimulatedUser>();
const slots = new Map<string, SubSlot>();

export function registerUser(args: SpawnArgs): SimulatedUser {
  const user = spawnSimulatedUser(args);
  users.set(user.userId, user);
  return user;
}

export function getUser(id: string): SimulatedUser | undefined {
  return users.get(id);
}

export function getAllUsers(): SimulatedUser[] {
  return Array.from(users.values());
}

export function dropUser(id: string) {
  const u = users.get(id);
  if (!u) return;
  void u.realtime.disconnect().catch(() => {});
  for (const slot of Array.from(slots.values())) {
    if (slot.simulatedUserId === id) slots.delete(slot.id);
  }
  users.delete(id);
}

export function addSlot(slot: SubSlot) {
  slots.set(slot.id, slot);
}

export function getSlot(id: string): SubSlot | undefined {
  return slots.get(id);
}

export function getSlotsFor(simulatedUserId: string): SubSlot[] {
  return Array.from(slots.values()).filter((s) => s.simulatedUserId === simulatedUserId);
}

export function getAllSlots(): SubSlot[] {
  return Array.from(slots.values());
}

export function markSlotEvent(slotId: string, evt: RealtimeResponseEvent<any>) {
  const slot = slots.get(slotId);
  if (!slot) return;
  slot.eventCount++;
  for (const id of evt.subscriptions ?? []) slot.serverIds.add(id);
  if (slot.closedAt !== undefined) slot.ghostEvents++;
}

export function markSlotClosed(slotId: string) {
  const slot = slots.get(slotId);
  if (!slot) return;
  slot.closedAt = Date.now();
}

export function patchSlot(
  slotId: string,
  patch: { channels?: string[]; queries?: string[]; presetLabel?: string; preset?: ChannelPreset },
) {
  const slot = slots.get(slotId);
  if (!slot) return;
  if (patch.channels) slot.channels = patch.channels;
  if (patch.queries) slot.queries = patch.queries;
  if (patch.presetLabel) slot.presetLabel = patch.presetLabel;
  if (patch.preset) slot.preset = patch.preset;
}

export function removeSlot(slotId: string) {
  slots.delete(slotId);
}
