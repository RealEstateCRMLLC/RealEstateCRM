// ─── MyPlus Leads Background Sync Scheduler ─────────────────────────────────
//
// Runs inside the Next.js Node runtime (`src/app/dashboard/layout.tsx`).
// Triggers `/api/cron/myplusleads` every 15 minutes over the local loopback
// port (`process.env.PORT || '3000'`) so production deployments on non-3000
// ports (e.g. Hetzner `:3210`) never fail with `ECONNREFUSED localhost:3000`.
// ─────────────────────────────────────────────────────────────────────────────

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes

const schedulerState = globalThis as typeof globalThis & {
  myPlusSchedulerTimer?: ReturnType<typeof setInterval>;
  myPlusLastSyncTimeMs?: number;
};

/**
 * Resolve the internal loopback base URL for server-to-self cron calls.
 * Prioritizes `INTERNAL_APP_URL`, then `127.0.0.1:${PORT || 3000}` so the
 * request stays inside the host without traversing public DNS/TLS or hitting
 * a dead `:3000` port when production runs on `:3210`.
 */
export function resolveInternalAppUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.INTERNAL_APP_URL && env.INTERNAL_APP_URL.trim()) {
    return env.INTERNAL_APP_URL.trim().replace(/\/+$/, '');
  }
  const port = env.PORT && /^\d+$/.test(env.PORT.trim()) ? env.PORT.trim() : '3000';
  return `http://127.0.0.1:${port}`;
}

export function startSyncScheduler() {
  if (schedulerState.myPlusSchedulerTimer) return;

  const tick = async () => {
    try {
      const nowMs = Date.now();
      const lastSync = schedulerState.myPlusLastSyncTimeMs ?? 0;
      if (nowMs - lastSync < CHECK_INTERVAL_MS) {
        return;
      }

      const baseUrl = resolveInternalAppUrl();
      const cronSecret = process.env.CRON_SECRET;

      const headers: Record<string, string> = {};
      if (cronSecret) {
        headers['Authorization'] = `Bearer ${cronSecret}`;
      }

      const res = await fetch(`${baseUrl}/api/cron/myplusleads`, {
        headers,
        signal: AbortSignal.timeout(60_000),
      });

      if (res.ok) {
        await res.json().catch(() => null);
        schedulerState.myPlusLastSyncTimeMs = nowMs;
      }
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : '';
      const message = err instanceof Error ? err.message : String(err);
      if (name !== 'AbortError' && name !== 'TimeoutError') {
        console.error('[MyPlus Scheduler] Sync attempt failed:', message);
      }
    }
  };

  // Defer initial tick slightly so server socket is bound before self-probe
  const warmup = setTimeout(() => {
    void tick();
  }, 5_000);
  warmup.unref();

  schedulerState.myPlusSchedulerTimer = setInterval(() => {
    void tick();
  }, CHECK_INTERVAL_MS);
  schedulerState.myPlusSchedulerTimer.unref();
}
