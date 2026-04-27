import { useEffect } from 'react';
import { MoreHorizontalIcon, PlayIcon, RefreshCwIcon, WavesIcon, FileTextIcon } from 'lucide-react';
import { useStore } from '@/state/store';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

export function StatusBar() {
  const { config, configError, loadConfig, rehydrateUsers, seed, seedRunning, seedLog, resetRows } = useStore();

  useEffect(() => {
    (async () => {
      await loadConfig();
      await rehydrateUsers();
    })();
  }, [loadConfig, rehydrateUsers]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="flex h-14 items-center gap-4 px-4">
        <div className="flex items-center gap-2">
          <WavesIcon className="size-4 text-muted-foreground" />
          <h1 className="text-sm font-semibold tracking-tight">Realtime Harness</h1>
          <Badge variant="outline" className="font-mono text-[10px]">
            idempotent-subscription
          </Badge>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex min-w-0 flex-1 items-center gap-4 text-xs">
          {configError ? (
            <span className="text-destructive">config error: {configError}</span>
          ) : config ? (
            <>
              <Chip label="endpoint" value={config.endpoint} />
              <Chip label="project" value={config.projectId} />
              <Chip label="database" value={config.databaseId} />
              <Chip label="table" value={config.tableId} />
            </>
          ) : (
            <span className="text-muted-foreground">loading config…</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {seedLog.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <FileTextIcon data-icon="inline-start" />
                  Seed log
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[420px] p-0">
                <ScrollArea className="h-64">
                  <pre className="p-3 font-mono text-[11px] leading-relaxed">
                    {seedLog.join('\n')}
                  </pre>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          )}

          <Button size="sm" disabled={seedRunning} onClick={() => seed()}>
            <PlayIcon data-icon="inline-start" />
            {seedRunning ? 'Seeding…' : 'Run seed'}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Setup</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => resetRows()}>
                  <RefreshCwIcon data-icon="inline-start" />
                  Reset rows
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => api.ping().catch(() => {})}>
                  <WavesIcon data-icon="inline-start" />
                  Ping Appwrite
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => loadConfig()}>Refresh config</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-foreground" title={value}>
        {value}
      </span>
    </div>
  );
}
