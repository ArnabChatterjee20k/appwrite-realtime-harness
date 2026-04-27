import { ID } from 'appwrite';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  MousePointerClickIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RadioIcon,
  RotateCcwIcon,
  SendIcon,
  XIcon,
  ZapIcon,
} from 'lucide-react';
import { useStore, type SubView, type UserView } from '@/state/store';
import type { ChannelPreset } from '@/sdk/channels';
import {
  BUILDER_OPS,
  DEFAULT_BUILDER_FILTER,
  builderToPreset,
  describeFilter,
  type BuilderFilter,
  type BuilderOp,
} from '@/lib/queryBuilder';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type AppPresetId = ChannelPreset['id'] | 'builder';

const PRESETS: Array<{ id: AppPresetId; label: string }> = [
  { id: 'all-rows', label: 'All rows' },
  { id: 'creates', label: 'Creates only' },
  { id: 'updates', label: 'Updates only' },
  { id: 'deletes', label: 'Deletes only' },
  { id: 'priority-high', label: 'priority = high' },
  { id: 'priority-medium', label: 'priority = medium' },
  { id: 'priority-low', label: 'priority = low' },
  { id: 'by-user', label: 'by userId' },
  { id: 'row-specific', label: 'row by id' },
  { id: 'builder', label: 'Query builder (AND)' },
  { id: 'custom', label: 'custom channel + raw queries' },
];

const BUILDER_FIELD_SUGGESTIONS = ['priority', 'userId', 'name', 'message', '$id', '$createdAt', '$updatedAt'];

export function UserWorkbench() {
  const users = useStore((s) => s.users);
  const activeUserId = useStore((s) => s.activeUserId);
  const active = users.find((u) => u.id === activeUserId) ?? users[0];

  if (!active) {
    return (
      <Card className="flex h-full min-h-0 flex-col">
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MousePointerClickIcon />
            </EmptyMedia>
            <EmptyTitle>No active user</EmptyTitle>
            <EmptyDescription>
              Spawn a user on the left to subscribe, run probes, and emit rows from its context.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    );
  }

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 py-0">
      <CardHeader className="gap-1 border-b py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="truncate">{active.name}</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                {active.socketState}
              </Badge>
            </CardTitle>
            <CardDescription className="truncate font-mono text-[11px]">
              {active.id}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <Tabs defaultValue="subs" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="border-b px-3 py-2">
            <TabsList>
              <TabsTrigger value="subs">
                <RadioIcon data-icon="inline-start" />
                Subscriptions ({active.subs.filter((s) => !s.closedAt).length})
              </TabsTrigger>
              <TabsTrigger value="probes">
                <ZapIcon data-icon="inline-start" />
                Probes
              </TabsTrigger>
              <TabsTrigger value="emit">
                <SendIcon data-icon="inline-start" />
                Emit
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="subs" className="flex min-h-0 flex-1 flex-col">
            <SubscriptionsTab user={active} />
          </TabsContent>
          <TabsContent value="probes" className="flex min-h-0 flex-1 flex-col">
            <ProbesTab userId={active.id} />
          </TabsContent>
          <TabsContent value="emit" className="flex min-h-0 flex-1 flex-col">
            <EmitterTab defaultUserId={active.id} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/* ------------------------------- Subscriptions ------------------------------- */

function SubscriptionsTab({ user }: { user: UserView }) {
  const { subscribe, unsubscribe, updateSubscription, closeSubscription, resubscribe } = useStore();
  const config = useStore((s) => s.config);
  const [preset, setPreset] = useState<AppPresetId>('all-rows');
  const [rowId, setRowId] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [rawChannel, setRawChannel] = useState('');
  const [customQueries, setCustomQueries] = useState('');
  const [builderFilters, setBuilderFilters] = useState<BuilderFilter[]>([{ ...DEFAULT_BUILDER_FILTER }]);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const p = buildPreset(preset, { rowId, userFilter, rawChannel, customQueries, builderFilters }, config);
      if (!p) return;
      await subscribe(user.id, p);
    } finally {
      setBusy(false);
    }
  }

  const extraField = <PresetExtraFields
    preset={preset}
    rowId={rowId} setRowId={setRowId}
    userFilter={userFilter} setUserFilter={setUserFilter}
    rawChannel={rawChannel} setRawChannel={setRawChannel}
    customQueries={customQueries} setCustomQueries={setCustomQueries}
    builderFilters={builderFilters} setBuilderFilters={setBuilderFilters}
  />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 border-b p-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            preset
          </label>
          <Select value={preset} onValueChange={(v) => setPreset(v as AppPresetId)}>
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {extraField}
        <Button size="sm" disabled={busy} onClick={go} className="w-full">
          <PlayIcon data-icon="inline-start" />
          Subscribe
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {user.subs.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No subscriptions yet. Pick a preset and click Subscribe.
          </div>
        ) : (
          <ul className="divide-y">
            {user.subs.map((s) => (
              <SubRow
                key={s.id}
                sub={s}
                onUnsub={() => unsubscribe(user.id, s.id)}
                onClose={() => closeSubscription(user.id, s.id)}
                onUpdate={(p) => updateSubscription(user.id, s.id, p)}
                onResubscribe={() => resubscribe(user.id, s.id)}
              />
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

type PresetInputs = {
  rowId: string;
  userFilter: string;
  rawChannel: string;
  customQueries: string;
  builderFilters: BuilderFilter[];
};

function buildPreset(
  preset: AppPresetId,
  inputs: PresetInputs,
  config: { databaseId: string; tableId: string } | undefined,
): ChannelPreset | undefined {
  switch (preset) {
    case 'all-rows': return { id: 'all-rows', label: 'All rows' };
    case 'creates': return { id: 'creates', label: 'Creates only' };
    case 'updates': return { id: 'updates', label: 'Updates only' };
    case 'deletes': return { id: 'deletes', label: 'Deletes only' };
    case 'priority-high': return { id: 'priority-high', label: 'priority = high' };
    case 'priority-medium': return { id: 'priority-medium', label: 'priority = medium' };
    case 'priority-low': return { id: 'priority-low', label: 'priority = low' };
    case 'by-user': return { id: 'by-user', label: 'userId = …', userId: inputs.userFilter || 'u_1' };
    case 'row-specific': return { id: 'row-specific', label: 'Row by ID', rowId: inputs.rowId || 'row_1' };
    case 'builder': {
      if (!config) return undefined;
      return builderToPreset(inputs.builderFilters, config.databaseId, config.tableId);
    }
    case 'custom': {
      const queries = inputs.customQueries
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      return { id: 'custom', label: queries.length ? `Custom · q[${queries.length}]` : 'Custom', raw: inputs.rawChannel, queries };
    }
    default: return undefined;
  }
}

function PresetExtraFields({
  preset,
  rowId, setRowId,
  userFilter, setUserFilter,
  rawChannel, setRawChannel,
  customQueries, setCustomQueries,
  builderFilters, setBuilderFilters,
}: {
  preset: AppPresetId;
  rowId: string; setRowId: (v: string) => void;
  userFilter: string; setUserFilter: (v: string) => void;
  rawChannel: string; setRawChannel: (v: string) => void;
  customQueries: string; setCustomQueries: (v: string) => void;
  builderFilters: BuilderFilter[]; setBuilderFilters: (v: BuilderFilter[]) => void;
}) {
  if (preset === 'row-specific') {
    return <FieldInput label="row id" value={rowId} onChange={setRowId} placeholder="row_1" grow />;
  }
  if (preset === 'by-user') {
    return <FieldInput label="userId filter" value={userFilter} onChange={setUserFilter} placeholder="u_1" grow />;
  }
  if (preset === 'builder') {
    return <QueryBuilder filters={builderFilters} onChange={setBuilderFilters} />;
  }
  if (preset === 'custom') {
    return (
      <div className="flex flex-col gap-2">
        <FieldInput label="raw channel" value={rawChannel} onChange={setRawChannel} placeholder="databases.x.tables.y.rows" grow />
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            queries (one per line)
          </label>
          <Textarea
            value={customQueries}
            onChange={(e) => setCustomQueries(e.target.value)}
            placeholder={`equal("priority","high")\nequal("userId","u_1")`}
            className="min-h-16 font-mono text-xs"
          />
        </div>
      </div>
    );
  }
  return null;
}

function QueryBuilder({
  filters,
  onChange,
}: {
  filters: BuilderFilter[];
  onChange: (next: BuilderFilter[]) => void;
}) {
  const set = (i: number, patch: Partial<BuilderFilter>) => {
    const next = filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
    onChange(next);
  };
  const remove = (i: number) => onChange(filters.filter((_, idx) => idx !== i));
  const add = () => onChange([...filters, { ...DEFAULT_BUILDER_FILTER }]);

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          filters (AND)
        </span>
        <Button size="xs" variant="outline" onClick={add}>
          <PlusIcon data-icon="inline-start" />
          Add filter
        </Button>
      </div>
      {filters.length === 0 ? (
        <div className="py-2 text-center text-xs text-muted-foreground">
          No filters. Subscribes to all rows.
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {filters.map((f, i) => {
            const opDef = BUILDER_OPS.find((o) => o.id === f.op);
            return (
              <li key={i} className="flex items-center gap-1">
                <Input
                  list="query-builder-fields"
                  value={f.field}
                  onChange={(e) => set(i, { field: e.target.value })}
                  placeholder="field"
                  className="h-7 flex-1 min-w-0 font-mono text-xs"
                />
                <Select
                  value={f.op}
                  onValueChange={(v) => set(i, { op: v as BuilderOp })}
                >
                  <SelectTrigger size="sm" className="w-[108px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {BUILDER_OPS.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {!opDef?.noValue && (
                  <Input
                    value={f.value}
                    onChange={(e) => set(i, { value: e.target.value })}
                    placeholder="value"
                    className="h-7 flex-1 min-w-0 font-mono text-xs"
                  />
                )}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remove filter"
                  onClick={() => remove(i)}
                >
                  <XIcon />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <datalist id="query-builder-fields">
        {BUILDER_FIELD_SUGGESTIONS.map((f) => <option key={f} value={f} />)}
      </datalist>
    </div>
  );
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

function IdChip({ label, full }: { label: string; full: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard?.writeText(full).catch(() => {});
          }}
          className="cursor-pointer"
        >
          {label}: <span className="text-foreground">{shortId(full)}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="font-mono">
        {full}
        <div className="mt-0.5 text-[10px] opacity-60">click to copy</div>
      </TooltipContent>
    </Tooltip>
  );
}

function SubRow({
  sub,
  onUnsub,
  onClose,
  onUpdate,
  onResubscribe,
}: {
  sub: SubView;
  onUnsub: () => void;
  onClose: () => void;
  onResubscribe?: () => void;
  onUpdate: (preset: ChannelPreset) => Promise<void>;
}) {
  const closed = !!sub.closedAt;
  return (
    <li
      className={cn(
        'flex items-center gap-3 px-3 py-2 text-xs',
        closed && 'opacity-60',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm text-foreground">{sub.presetLabel}</span>
          {closed && <Badge variant="outline">closed</Badge>}
          {sub.ghostEvents > 0 && (
            <Badge variant="destructive">ghost × {sub.ghostEvents}</Badge>
          )}
        </div>
        <div className="truncate font-mono text-[10px] text-muted-foreground">
          {sub.channels.join(', ')}
          {sub.queries.length > 0 && ` · q[${sub.queries.length}]`}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-muted-foreground">
          <IdChip label="slot" full={sub.id} />
          {sub.serverIds.length === 0 ? (
            <span className="italic">server: awaiting ack…</span>
          ) : sub.serverIds.length === 1 ? (
            <IdChip label="server" full={sub.serverIds[0]} />
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help underline decoration-dotted underline-offset-2">
                  server: <span className="text-foreground">{shortId(sub.serverIds[0])}</span>
                  <span className="ml-1 text-destructive">+{sub.serverIds.length - 1}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-md whitespace-pre font-mono">
                {sub.serverIds.join('\n')}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 font-mono text-[11px] text-muted-foreground">
        <span>evt:<span className="ml-0.5 text-foreground">{sub.eventCount}</span></span>
      </div>
      <Separator orientation="vertical" className="h-5" />
      <div className="flex shrink-0 items-center gap-1">
        {closed ? (
          onResubscribe && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={onResubscribe}>
                  <RotateCcwIcon data-icon="inline-start" />
                  Resubscribe
                </Button>
              </TooltipTrigger>
              <TooltipContent>Re-open this subscription with the same channels and queries</TooltipContent>
            </Tooltip>
          )
        ) : (
          <>
            <UpdatePopover onApply={onUpdate} currentLabel={sub.presetLabel} />
            <Button size="sm" variant="outline" onClick={onUnsub}>
              Unsub
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Close" onClick={onClose}>
                  <XIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Hard close (keeps slot for ghost-event detection)</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </li>
  );
}

function UpdatePopover({
  onApply,
  currentLabel,
}: {
  onApply: (preset: ChannelPreset) => Promise<void>;
  currentLabel: string;
}) {
  const config = useStore((s) => s.config);
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<AppPresetId>('all-rows');
  const [rowId, setRowId] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [rawChannel, setRawChannel] = useState('');
  const [customQueries, setCustomQueries] = useState('');
  const [builderFilters, setBuilderFilters] = useState<BuilderFilter[]>([{ ...DEFAULT_BUILDER_FILTER }]);
  const [busy, setBusy] = useState(false);

  async function apply() {
    setBusy(true);
    try {
      const p = buildPreset(preset, { rowId, userFilter, rawChannel, customQueries, builderFilters }, config);
      if (!p) return;
      await onApply(p);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Update subscription">
              <PencilIcon />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Update channels/queries in place (preserves server subscription ID)</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex flex-col gap-2">
          <div className="text-[11px] text-muted-foreground">
            currently: <span className="text-foreground">{currentLabel}</span>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              new preset
            </label>
            <Select value={preset} onValueChange={(v) => setPreset(v as AppPresetId)}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <PresetExtraFields
            preset={preset}
            rowId={rowId} setRowId={setRowId}
            userFilter={userFilter} setUserFilter={setUserFilter}
            rawChannel={rawChannel} setRawChannel={setRawChannel}
            customQueries={customQueries} setCustomQueries={setCustomQueries}
            builderFilters={builderFilters} setBuilderFilters={setBuilderFilters}
          />
          <Button size="sm" disabled={busy} onClick={apply} className="w-full">
            <PencilIcon data-icon="inline-start" />
            {busy ? 'Updating…' : 'Apply update'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  grow,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  grow?: boolean;
}) {
  return (
    <div className={cn('flex flex-col gap-1', grow && 'flex-1')}>
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 font-mono text-xs"
      />
    </div>
  );
}

/* ---------------------------------- Probes ---------------------------------- */

type ProbeId =
  | 'rapid'
  | 'late'
  | 'sub-before-ack'
  | 'churn'
  | 'reconnect'
  | 'duplicate'
  | 'bulk'
  | 'update-cycle';

const PROBES: Array<{ id: ProbeId; label: string; desc: string }> = [
  { id: 'rapid', label: 'Rapid (3×sync)', desc: '3 subscribe() calls in one microtask — tests debounce batching' },
  { id: 'late', label: 'Late (3s delay)', desc: 'Subscribe 3s after socket open — tests late-joiner delivery' },
  { id: 'sub-before-ack', label: 'Sub-before-ack', desc: 'close() before subscribe() promise resolves' },
  { id: 'churn', label: 'Churn (5 cycles)', desc: '5× subscribe / 40ms / close cycles' },
  { id: 'reconnect', label: 'Reconnect', desc: 'Force close the WebSocket and verify auto-reconnect' },
  { id: 'duplicate', label: 'Duplicate subscribe', desc: 'Same channel twice — tests idempotent-subscription behavior' },
  { id: 'bulk', label: 'Bulk (10 parallel)', desc: '10 subscribe() calls in parallel' },
  { id: 'update-cycle', label: 'Update cycle (3×update)', desc: 'subscribe(all) → update(creates) → update(priority=high) — server ID must stay stable' },
];

function ProbesTab({ userId }: { userId: string }) {
  const { probes, subscribe, updateSubscription, closeSubscription, forceReconnect, recordProbe, updateProbe } = useStore();

  async function run(probe: ProbeId) {
    const logId = ID.unique();
    recordProbe({ id: logId, name: probe, startedAt: Date.now() });
    try {
      if (probe === 'rapid') {
        await Promise.all([
          subscribe(userId, { id: 'all-rows', label: 'All rows' }),
          subscribe(userId, { id: 'creates', label: 'Creates only' }),
          subscribe(userId, { id: 'updates', label: 'Updates only' }),
        ]);
      } else if (probe === 'late') {
        await new Promise((r) => setTimeout(r, 3000));
        await subscribe(userId, { id: 'all-rows', label: 'All rows' });
      } else if (probe === 'sub-before-ack') {
        const slotsBefore = useStore.getState().users.find((u) => u.id === userId)?.subs ?? [];
        const p = subscribe(userId, { id: 'all-rows', label: 'All rows' });
        queueMicrotask(async () => {
          const latest = useStore.getState().users.find((u) => u.id === userId)?.subs ?? [];
          const newSlot = latest.find((s) => !slotsBefore.some((b) => b.id === s.id));
          if (newSlot) await closeSubscription(userId, newSlot.id);
        });
        await p;
      } else if (probe === 'churn') {
        for (let i = 0; i < 5; i++) {
          const slotsBefore = useStore.getState().users.find((u) => u.id === userId)?.subs ?? [];
          await subscribe(userId, { id: 'all-rows', label: 'All rows' });
          await new Promise((r) => setTimeout(r, 40));
          const latest = useStore.getState().users.find((u) => u.id === userId)?.subs ?? [];
          const newSlot = latest.find((s) => !slotsBefore.some((b) => b.id === s.id));
          if (newSlot) await closeSubscription(userId, newSlot.id);
        }
      } else if (probe === 'reconnect') {
        forceReconnect(userId);
      } else if (probe === 'duplicate') {
        await subscribe(userId, { id: 'all-rows', label: 'Dup A' });
        await subscribe(userId, { id: 'all-rows', label: 'Dup B' });
      } else if (probe === 'bulk') {
        await Promise.all(Array.from({ length: 10 }).map(() => subscribe(userId, { id: 'all-rows', label: 'Bulk' })));
      } else if (probe === 'update-cycle') {
        const slotsBefore = useStore.getState().users.find((u) => u.id === userId)?.subs ?? [];
        await subscribe(userId, { id: 'all-rows', label: 'All rows' });
        const latest = useStore.getState().users.find((u) => u.id === userId)?.subs ?? [];
        const slot = latest.find((s) => !slotsBefore.some((b) => b.id === s.id));
        if (!slot) throw new Error('update-cycle: new slot not found after subscribe');
        await new Promise((r) => setTimeout(r, 60));
        await updateSubscription(userId, slot.id, { id: 'creates', label: 'Creates only' });
        await new Promise((r) => setTimeout(r, 60));
        await updateSubscription(userId, slot.id, { id: 'priority-high', label: 'priority = high' });
      }
      updateProbe(logId, { ok: true, finishedAt: Date.now() });
    } catch (e: any) {
      updateProbe(logId, { ok: false, finishedAt: Date.now(), detail: e?.message ?? String(e) });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <ul className="divide-y">
          {PROBES.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => run(p.id)}
                className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
              >
                <ZapIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.label}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.desc}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="opacity-60 group-hover:opacity-100"
                  asChild
                >
                  <span>
                    <PlayIcon data-icon="inline-start" />
                    Run
                  </span>
                </Button>
              </button>
            </li>
          ))}
        </ul>

        {probes.length > 0 && (
          <>
            <div className="flex items-center justify-between border-y bg-muted/30 px-3 py-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Recent runs
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {probes.length} total
              </span>
            </div>
            <ul className="divide-y font-mono text-[11px]">
              {probes.map((p) => (
                <li key={p.id} className="flex items-center gap-2 px-3 py-1.5">
                  <span
                    className={cn(
                      'inline-flex size-4 items-center justify-center rounded-full text-[10px]',
                      p.ok === true && 'bg-emerald-500/15 text-emerald-500',
                      p.ok === false && 'bg-destructive/15 text-destructive',
                      p.ok === undefined && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {p.ok === undefined ? '…' : p.ok ? '✓' : '✗'}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(p.startedAt).toLocaleTimeString()}
                  </span>
                  <span className="text-foreground">{p.name}</span>
                  {p.detail && <span className="truncate text-destructive">{p.detail}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </ScrollArea>
    </div>
  );
}

/* --------------------------------- Emitter --------------------------------- */

const CUSTOM_USER_SENTINEL = '__custom__';

function EmitterTab({ defaultUserId }: { defaultUserId: string }) {
  const users = useStore((s) => s.users);
  const [name, setName] = useState('hello from server');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [userId, setUserId] = useState(defaultUserId);
  const [customMode, setCustomMode] = useState(false);
  const [rowId, setRowId] = useState('');
  const [bulk, setBulk] = useState(5);
  const [patchTarget, setPatchTarget] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  // If the previously-selected userId is no longer in the known list and we weren't in custom mode,
  // flip to custom so the user can still see/edit it.
  const isKnown = users.some((u) => u.id === userId);
  const selectValue = customMode || !isKnown ? CUSTOM_USER_SENTINEL : userId;

  const msgBadge = useMemo(() => {
    if (!msg) return null;
    const err = msg.startsWith('err:');
    return { text: msg, err };
  }, [msg]);

  async function run(fn: () => Promise<any>) {
    setMsg(null);
    try {
      const r = await fn();
      setMsg(JSON.stringify(r).slice(0, 200));
    } catch (e: any) {
      setMsg(`err: ${e?.message ?? String(e)}`);
    }
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-4 p-3">
        <section className="flex flex-col gap-2">
          <SectionLabel>Row payload</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <FieldInput label="name" value={name} onChange={setName} placeholder="hello from server" />
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                priority
              </label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="low">low</SelectItem>
                    <SelectItem value="medium">medium</SelectItem>
                    <SelectItem value="high">high</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                userId
              </label>
              <Select
                value={selectValue}
                onValueChange={(v) => {
                  if (v === CUSTOM_USER_SENTINEL) {
                    setCustomMode(true);
                  } else {
                    setCustomMode(false);
                    setUserId(v);
                  }
                }}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_USER_SENTINEL}>Custom id…</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <FieldInput label="rowId" value={rowId} onChange={setRowId} placeholder="auto" />
          </div>
          {(customMode || !isKnown) && (
            <FieldInput
              label="custom userId"
              value={userId}
              onChange={setUserId}
              placeholder="u_1"
              grow
            />
          )}
        </section>

        <Separator />

        <section className="flex flex-col gap-2">
          <SectionLabel>Create</SectionLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => run(() => api.createRow({ name, priority, userId, rowId: rowId || undefined }))}
            >
              <SendIcon data-icon="inline-start" />
              Create row
            </Button>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={200}
                value={bulk}
                onChange={(e) => setBulk(Number(e.target.value))}
                className="h-8 w-20 font-mono text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => run(() => api.bulkRows(bulk, { name, priority, userId }))}
              >
                Bulk create
              </Button>
            </div>
          </div>
        </section>

        <Separator />

        <section className="flex flex-col gap-2">
          <SectionLabel>Patch / delete by id</SectionLabel>
          <div className="flex flex-wrap items-end gap-2">
            <FieldInput label="target row id" value={patchTarget} onChange={setPatchTarget} placeholder="row id" grow />
            <Button
              size="sm"
              variant="outline"
              disabled={!patchTarget}
              onClick={() => run(() => api.patchRow(patchTarget, { name, priority }))}
            >
              Patch
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={!patchTarget}
              onClick={() => run(() => api.deleteRow(patchTarget))}
            >
              Delete
            </Button>
          </div>
        </section>

        {msgBadge && (
          <pre
            className={cn(
              'truncate rounded-md border px-2 py-1.5 font-mono text-[11px]',
              msgBadge.err
                ? 'border-destructive/40 bg-destructive/5 text-destructive'
                : 'border-border bg-muted/40 text-muted-foreground',
            )}
          >
            {msgBadge.text}
          </pre>
        )}
      </div>
    </ScrollArea>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}
