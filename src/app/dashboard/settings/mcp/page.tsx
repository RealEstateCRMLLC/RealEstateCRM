/**
 * Redirect to the consolidated settings page.
 * This panel lives inline in SettingsTabs (?tab=mcp); this route is
 * kept only for bookmarks and external deep links (same pattern as the
 * reporting/analytics merge).
 */
import { redirect } from 'next/navigation';

export default function MCPSettingsRedirect() {
  redirect('/dashboard/settings?tab=mcp');
}
