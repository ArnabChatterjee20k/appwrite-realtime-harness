import { useMemo, useState } from 'react';
import { ActivityIcon, FilterIcon, PauseIcon, PlayIcon, Trash2Icon } from 'lucide-react';
import { useStore, userColor, type EventRow } from '@/state/store';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function EventStream() {
  const { events, users, feedPaused, setFeedPaused, clearEvents } = useStore();
  const [userFilter, setUserFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const filtered = useMemo(
    () =>
      events.filter((e) => {
        if (userFilter && e.simulatedUserId !== userFilter) return false;
        if (typeFilter && !e.events.some((ev) => ev.includes(typeFilter))) return false;
        return true;
      }),
    [events, userFilter, typeFilter],
  );

  const filtering = !!userFilter || !!typeFilter;

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 py-0">
      <CardHeader className="gap-1 border-b py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ActivityIcon className="size-4 text-muted-foreground" />
              Event stream
              <Badge variant="outline" className="font-mono">
                {filtered.length}
                {filtering && ` / ${events.length}`}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Realtime messages across all users · newest first
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={feedPaused ? 'default' : 'outline'}
                  aria-label={feedPaused ? 'Resume' : 'Pause'}
                  onClick={() => setFeedPaused(!feedPaused)}
                >
                  {feedPaused ? <PlayIcon /> : <PauseIcon />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{feedPaused ? 'Resume capture' : 'Pause capture'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Clear events"
                  onClick={clearEvents}
                >
                  <Trash2Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear feed</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <FilterIcon className="size-3.5 text-muted-foreground" />
          <Select
            value={userFilter || 'all'}
            onValueChange={(v) => setUserFilter(v === 'all' ? '' : v)}
          >
            <SelectTrigger size="sm" className="min-w-36">
              <SelectValue placeholder="all users" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">all users</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Input
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            placeholder="type contains…"
            className="h-7 w-48 font-mono text-xs"
          />
          {filtering && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setUserFilter('');
                setTypeFilter('');
              }}
            >
              Reset
            </Button>
          )}
          {feedPaused && <Badge variant="secondary">paused</Badge>}
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 p-0">
        {filtered.length === 0 ? (
          <Empty className="flex-1 rounded-none border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ActivityIcon />
              </EmptyMedia>
              <EmptyTitle>No events yet</EmptyTitle>
              <EmptyDescription>
                Subscribe on a user, then emit rows from the Emit tab to see messages here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ScrollArea className="min-h-0 w-full flex-1">
            <ul className="divide-y">
              {filtered.map((e) => (
                <EventItem key={e.id} event={e} />
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function EventItem({ event }: { event: EventRow }) {
  const [open, setOpen] = useState(false);
  const color = userColor(event.simulatedUserId);
  const action = event.events[0] ?? '?';
  const channel = event.channels[0] ?? '';
  const serverSub = event.subscriptions[0];

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-accent/40"
      >
        <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">
          {new Date(event.timestamp).toLocaleTimeString()}
        </span>
        <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
          {shortAction(action)}
        </Badge>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
          {channel}
        </span>
        {serverSub && (
          <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:inline">
            sub:{serverSub.slice(-6)}
          </span>
        )}
        <span
          className="shrink-0 font-mono text-[10px]"
          style={{ color }}
        >
          u:{event.simulatedUserId.slice(-6)}
        </span>
      </button>
      {open && (
        <pre className="max-h-64 overflow-auto border-t bg-muted/30 px-3 py-2 font-mono text-[11px] leading-relaxed">
          {JSON.stringify(
            {
              events: event.events,
              channels: event.channels,
              subscriptions: event.subscriptions,
              payload: event.payload,
            },
            null,
            2,
          )}
        </pre>
      )}
    </li>
  );
}

function shortAction(action: string): string {
  // "databases.<id>.tables.<id>.rows.<id>.create" → "create"
  const parts = action.split('.');
  return parts[parts.length - 1] || action;
}
