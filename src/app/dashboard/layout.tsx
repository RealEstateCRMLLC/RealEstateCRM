import Link from 'next/link';
import AIChat from '@/components/AIChat';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SignOutButton from '@/components/SignOutButton';
import { getProjectVersion } from '@/lib/version';
import UserProfileDropdown from '@/components/UserProfileDropdown';
import { CommandPalette } from '@/components/CommandPalette';
import { DashboardHeaderActions } from '@/components/DashboardHeaderActions';
import { requireWorkspaceAccess } from '@/lib/workspace-access';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';
import { OnboardingTour } from '@/components/OnboardingTour';
import { ThemeToggle } from '@/components/ThemeToggle';
import prisma from '@/lib/prisma';
import Script from 'next/script';
import CommunicationsHub from '@/components/CommunicationsHub';
import { processDueCampaignTasks } from '@/lib/campaign-processor';
import { startSyncScheduler } from '@/lib/sync-scheduler';
import LeadAlertListener from '@/components/LeadAlertListener';
import NotificationDropdown from '@/components/NotificationDropdown';
import SidebarNav from '@/components/dashboard/SidebarNav';
import { getWorkspaceBranding, DEFAULT_BRANDING } from '@/lib/branding';
import { resolveUniversalTenant } from '@/lib/universal/tenant';
import { getStoredTenantRecord } from '@/lib/universal/tenant-store';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch (err) {
    console.warn('Session decryption failed:', err);
  }

  if (!session) {
    redirect('/api/auth/signin');
  }

  // Start MyPlusLeads background sync scheduler if not already started
  try {
    startSyncScheduler();
  } catch (e) {
    console.error('Failed to start sync scheduler:', e);
  }

  // Auto-process any pending drip campaign steps that are now due
  try {
    await processDueCampaignTasks();
  } catch (e) {
    console.error('Failed processing due drip campaigns in layout:', e);
  }

  // Workspace access can throw WorkspaceAccessError (or a Turbopack-duplicated
  // variant that fails instanceof checks). Catch here so the layout never crashes
  // — individual pages handle their own access denials via error.tsx boundaries.
  let workspaces: { id: string; name: string; slug: string }[] = [];
  let access: Awaited<ReturnType<typeof requireWorkspaceAccess>> | null = null;
  let resolvedTenant: ReturnType<typeof resolveUniversalTenant> | null = null;
  try {
    access = await requireWorkspaceAccess(session);
    const [memberWorkspaces, branding, tenantRecord] = await Promise.all([
      prisma.workspace.findMany({
        where: {
          members: {
            some: { userId: access.userId },
          },
        },
      }),
      getWorkspaceBranding(access.workspaceId).catch(() => DEFAULT_BRANDING),
      getStoredTenantRecord(access.workspaceId),
    ]);
    workspaces = memberWorkspaces;
    resolvedTenant = resolveUniversalTenant(tenantRecord, branding);
  } catch (e) {
    console.error('Workspace access check failed in dashboard layout:', e);
  }

  const brandName = resolvedTenant?.brand.name || 'Excel Legacy';
  const brandInitial = brandName.trim().charAt(0).toUpperCase() || 'E';
  const brandAccent = resolvedTenant?.brand.accentColor || undefined;
  const sectorTooltip = resolvedTenant
    ? `Active Universal CRM Pack: ${resolvedTenant.sector.name} (${resolvedTenant.vocabulary.customer} / ${resolvedTenant.vocabulary.workUnit} / ${resolvedTenant.vocabulary.offering}) • Locale: ${resolvedTenant.language.label} (${resolvedTenant.language.code.toUpperCase()}) • Click to configure sector, branding, or language`
    : 'Configure Universal CRM sector pack, vocabulary, and language';

  return (
    <div
      className="flex h-screen bg-background"
      dir={resolvedTenant?.language.rtl ? 'rtl' : undefined}
    >
      {/* Sidebar */}
      <aside aria-label="Main sidebar" className="w-64 border-r border-border bg-muted/30 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-6 h-6 rounded-sm bg-secondary flex items-center justify-center font-bold text-secondary-foreground text-xs shrink-0"
              style={brandAccent ? { backgroundColor: brandAccent, color: '#0a0a0a' } : undefined}
            >
              {brandInitial}
            </div>
            <span className="font-semibold text-primary dark:text-foreground truncate" title={brandName}>
              {brandName}
            </span>
          </div>
        </div>

        <SidebarNav />
        <div className="p-4 border-t border-border bg-muted/10 space-y-1">
          {resolvedTenant && (
            <div className="text-[10px] text-muted-foreground text-center truncate" title={sectorTooltip}>
              {resolvedTenant.sector.name} • {resolvedTenant.language.native}
            </div>
          )}
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest text-center font-bold">
            Version {getProjectVersion()}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-background flex items-center justify-between px-3 sm:px-6 sticky top-0 z-10">
          <div className="md:hidden flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-sm bg-secondary flex items-center justify-center font-bold text-secondary-foreground text-xs"
              style={brandAccent ? { backgroundColor: brandAccent, color: '#0a0a0a' } : undefined}
            >
              {brandInitial}
            </div>
          </div>
          <div className="flex-1 flex items-center justify-between px-4">
            <div className="flex-1 flex justify-center">
              <CommandPalette />
            </div>
            <div className="flex items-center gap-3">
              {resolvedTenant && (
                <Link
                  href="/dashboard/settings?tab=sector-pack"
                  title={sectorTooltip}
                  className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full border border-border bg-muted/40 hover:border-secondary/50 text-foreground transition-colors"
                >
                  <span>🌍</span>
                  <span>{resolvedTenant.sector.name}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="uppercase text-secondary">{resolvedTenant.language.code}</span>
                </Link>
              )}
              <ThemeToggle />
              <NotificationDropdown />
              <WorkspaceSwitcher workspaces={workspaces} activeSlug={access?.workspaceSlug || ''} />
              <span className="hidden sm:inline-flex px-2.5 py-1 text-[10px] font-bold rounded-full bg-secondary/15 text-secondary border border-secondary/30 uppercase tracking-wider">
                {(access?.workspaceRole ?? 'REALTOR_AGENT').replace('REALTOR_', '').replace('_', ' ')} Seat
              </span>
              <UserProfileDropdown 
                userName={session?.user?.name || 'User'} 
                userEmail={session?.user?.email || 'user@excellegacyrealtygroup.site'} 
              />
            </div>
          </div>
          <div className="flex items-center gap-4 ml-4">
            <DashboardHeaderActions />
          </div>
        </header>
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-auto p-3 sm:p-6">{children}</div>
          {/* Comms hub is a fixed 384px rail when expanded: below lg it would
              consume the whole viewport and clip the page, so it is desktop-only. */}
          <div className="hidden lg:flex">
            <CommunicationsHub />
          </div>
        </div>
      </main>
      <LeadAlertListener />
      <AIChat />
      <OnboardingTour />
      {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places,drawing`}
          strategy="afterInteractive"
        />
      )}
    </div>
  );
}
