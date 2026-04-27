import { useState } from 'react';
import { MoreVerticalIcon, PlusIcon, RotateCcwIcon, Trash2Icon, UsersIcon } from 'lucide-react';
import { useStore, userColor, type UserView } from '@/state/store';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export function UsersList() {
  const { users, activeUserId, setActiveUser, addUser, removeUser, purgeUsers, forceReconnect } = useStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function spawn() {
    setErr(null);
    setBusy(true);
    try {
      await addUser();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 py-0">
      <CardHeader className="gap-1 border-b py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Users</CardTitle>
            <CardDescription className="text-xs">
              {users.length} simulated · WebSocket each
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" disabled={busy} onClick={spawn}>
              <PlusIcon data-icon="inline-start" />
              {busy ? 'Spawning…' : 'Add'}
            </Button>
            {users.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More">
                    <MoreVerticalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => purgeUsers()}
                  >
                    <Trash2Icon data-icon="inline-start" />
                    Purge all
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-0">
        {err && (
          <Alert variant="destructive" className="m-3">
            <AlertTitle>Failed to spawn user</AlertTitle>
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}

        {users.length === 0 ? (
          <Empty className="flex-1">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon />
              </EmptyMedia>
              <EmptyTitle>No simulated users</EmptyTitle>
              <EmptyDescription>
                Spawn a user to open a WebSocket and start subscribing to channels.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" disabled={busy} onClick={spawn}>
                <PlusIcon data-icon="inline-start" />
                Add first user
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <ul className="divide-y">
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  active={u.id === activeUserId}
                  onSelect={() => setActiveUser(u.id)}
                  onReconnect={() => forceReconnect(u.id)}
                  onRemove={() => removeUser(u.id)}
                />
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function UserRow({
  user,
  active,
  onSelect,
  onReconnect,
  onRemove,
}: {
  user: UserView;
  active: boolean;
  onSelect: () => void;
  onReconnect: () => void;
  onRemove: () => void;
}) {
  const activeSubs = user.subs.filter((s) => !s.closedAt).length;
  const color = userColor(user.id);
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          'flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors outline-none focus-visible:bg-accent/60',
          active ? 'bg-accent' : 'hover:bg-accent/50',
        )}
      >
        <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{user.name}</span>
            <StateDot state={user.socketState} />
          </div>
          <div className="truncate font-mono text-[10px] text-muted-foreground">{user.id}</div>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground">
          <Stat label="subs" value={activeSubs} />
          <Stat label="evt" value={user.eventCount} />
          {user.errorCount > 0 && (
            <Stat label="err" value={user.errorCount} tone="destructive" />
          )}
        </div>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${user.name} actions`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVerticalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={onReconnect}>
              <RotateCcwIcon data-icon="inline-start" />
              Force reconnect
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onRemove}>
              <Trash2Icon data-icon="inline-start" />
              Remove user
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {user.lastError && (
        <div className="border-t bg-destructive/5 px-3 py-1.5 font-mono text-[11px] text-destructive">
          {user.lastError}
        </div>
      )}
    </li>
  );
}

function StateDot({ state }: { state: string }) {
  const color =
    state === 'open'
      ? 'bg-emerald-500'
      : state === 'connecting'
      ? 'bg-amber-500 animate-pulse'
      : state === 'error'
      ? 'bg-destructive'
      : 'bg-muted-foreground/40';
  return (
    <span
      title={state}
      className={cn('size-1.5 shrink-0 rounded-full', color)}
    />
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'destructive';
}) {
  return (
    <span className={cn('font-mono', tone === 'destructive' && 'text-destructive')}>
      {label}:<span className="ml-0.5 text-foreground">{value}</span>
    </span>
  );
}
