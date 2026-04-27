import { useState } from 'react';
import { CheckCircle2Icon, ChevronDownIcon, XCircleIcon } from 'lucide-react';
import { useStore } from '@/state/store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Check = { label: string; pass: boolean; detail?: string };

function computeChecks(users: ReturnType<typeof useStore.getState>['users']): Check[] {
  const allSubs = users.flatMap((u) => u.subs.map((s) => ({ ...s, userId: u.id })));
  const activeSubs = allSubs.filter((s) => !s.closedAt);

  const slotIds = new Set(allSubs.map((s) => s.id));
  const uniqueSlot: Check = {
    label: 'Unique client-side slot IDs',
    pass: slotIds.size === allSubs.length,
    detail: `${allSubs.length} slots · ${slotIds.size} unique`,
  };

  const ghosts = allSubs.reduce((n, s) => n + s.ghostEvents, 0);
  const ghostCheck: Check = {
    label: 'No ghost events to closed subs',
    pass: ghosts === 0,
    detail: ghosts === 0 ? 'clean' : `${ghosts} ghost event(s) observed`,
  };

  const idToSlot = new Map<string, string>();
  let collisions = 0;
  for (const s of activeSubs) {
    for (const id of s.serverIds) {
      if (idToSlot.has(id) && idToSlot.get(id) !== s.id) collisions++;
      else idToSlot.set(id, s.id);
    }
  }
  const uniqueServer: Check = {
    label: 'Unique server subscription IDs per active slot',
    pass: collisions === 0,
    detail: collisions === 0 ? `${idToSlot.size} distinct server IDs tracked` : `${collisions} collision(s)`,
  };

  const reminted = activeSubs.filter((s) => s.serverIds.length > 1).length;
  const stable: Check = {
    label: 'Server ID stable per subscription (reconnect idempotency)',
    pass: reminted === 0,
    detail: reminted === 0 ? 'no re-mints observed' : `${reminted} subscription(s) saw >1 server ID`,
  };

  return [uniqueSlot, ghostCheck, uniqueServer, stable];
}

export function AssertionsBanner() {
  const users = useStore((s) => s.users);
  const checks = computeChecks(users);
  const failing = checks.filter((c) => !c.pass).length;
  const allPass = failing === 0;
  const [expanded, setExpanded] = useState(false);

  // Auto-expand when something fails so the detail surfaces without a click.
  const open = expanded || !allPass;

  return (
    <section
      className={cn(
        'rounded-xl border transition-colors',
        allPass ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-destructive/40 bg-destructive/5',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {allPass ? (
          <CheckCircle2Icon className="size-5 shrink-0 text-emerald-500" />
        ) : (
          <XCircleIcon className="size-5 shrink-0 text-destructive" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">
            {allPass ? 'All checks passing' : `${failing} check${failing === 1 ? '' : 's'} failing`}
          </div>
          <div className="text-xs text-muted-foreground">
            {checks.length} idempotency &amp; lifecycle invariants across {users.length} user
            {users.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {checks.map((c) => (
            <span
              key={c.label}
              className={cn(
                'size-2 rounded-full',
                c.pass ? 'bg-emerald-500' : 'bg-destructive',
              )}
              title={c.label}
            />
          ))}
          <Button variant="ghost" size="icon" className="ml-1" asChild>
            <span>
              <ChevronDownIcon
                className={cn('transition-transform', open && 'rotate-180')}
              />
            </span>
          </Button>
        </div>
      </button>

      {open && (
        <ul className="border-t px-4 py-2 text-sm">
          {checks.map((c) => (
            <li
              key={c.label}
              className="flex items-center gap-3 border-b py-1.5 last:border-0"
            >
              {c.pass ? (
                <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />
              ) : (
                <XCircleIcon className="size-4 shrink-0 text-destructive" />
              )}
              <span className={cn('flex-1', !c.pass && 'text-destructive')}>{c.label}</span>
              {c.detail && (
                <span className="font-mono text-xs text-muted-foreground">{c.detail}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
