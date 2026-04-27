import { StatusBar } from '@/components/StatusBar';
import { AssertionsBanner } from '@/components/AssertionsBanner';
import { UsersList } from '@/components/UsersList';
import { UserWorkbench } from '@/components/UserWorkbench';
import { EventStream } from '@/components/EventStream';
import { TooltipProvider } from '@/components/ui/tooltip';

export function App() {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-dvh flex-col overflow-hidden">
        <StatusBar />
        <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-4 overflow-hidden p-4">
          <AssertionsBanner />
          <div className="grid min-h-0 flex-1 gap-4 grid-cols-1 lg:grid-cols-[300px_minmax(0,1.1fr)_minmax(0,1fr)]">
            <UsersList />
            <UserWorkbench />
            <EventStream />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
