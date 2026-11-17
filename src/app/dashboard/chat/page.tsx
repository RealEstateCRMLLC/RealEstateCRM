/**
 * Redirect to the Unified Inbox, which embeds the full TeamChat
 * (directory, online status, room creation). This route was a second,
 * weaker copy of the same chat UI over the same /api/chat data;
 * kept only for bookmarks and external deep links (same pattern as
 * the reporting/analytics and settings merges).
 */
import { redirect } from 'next/navigation';

export default function TeamChatRedirect() {
  redirect('/dashboard/inbox');
}
