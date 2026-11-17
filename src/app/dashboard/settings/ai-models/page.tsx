/**
 * Redirect to the consolidated settings page.
 * This panel lives inline in SettingsTabs (?tab=ai-models); this route is
 * kept only for bookmarks and external deep links (same pattern as the
 * reporting/analytics merge).
 */
import { redirect } from 'next/navigation';

export default function AIModelsSettingsRedirect() {
  redirect('/dashboard/settings?tab=ai-models');
}
