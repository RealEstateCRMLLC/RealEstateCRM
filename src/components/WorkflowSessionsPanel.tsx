'use client';
// Workflow Sessions Panel — searchable list of saved/resumable workflow & foreclosure sessions
// from /api/workflow-sessions with one-click CSV export for foreclosure intake records.

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface WorkflowSession {
  id: string;
  type: string;
  status: string;
  data?: { draft?: Record<string, string> } & Record<string, unknown>;
  leadId?: string | null;
  dealId?: string | null;
  leadName?: string | null;
  dealTitle?: string | null;
  lead?: { id: string; contact: { firstName: string; lastName: string | null } } | null;
  updatedAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  'offer-draft': 'Offer Draft',
  'listing-entry': 'Listing Entry',
  'foreclosure-intake': 'Foreclosure Intake',
  'marketing-media': 'Media Studio',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-amber-500/15 text-amber-500',
  IN_PROGRESS: 'bg-blue-500/15 text-blue-500',
  COMPLETED: 'bg-green-500/15 text-green-500',
  ABANDONED: 'bg-muted/15 text-muted-foreground',
};

function baseWorkflowType(type: string): string {
  return type.split(':')[0] || type;
}

function extractDraft(session: WorkflowSession): Record<string, string> {
  const raw = session.data;
  if (!raw || typeof raw !== 'object') return {};
  if (raw.draft && typeof raw.draft === 'object') {
    return raw.draft;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

export default function WorkflowSessionsPanel() {
  const [sessions, setSessions] = useState<WorkflowSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'foreclosures'>('all');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/workflow-sessions');
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : data.sessions || []);
    } catch {
      // silent — panel is non-critical
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const discard = async (id: string) => {
    try {
      const res = await fetch(`/api/workflow-sessions?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
        toast.success('Session discarded');
      } else {
        toast.error('Failed to discard session');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const resumeHref = (s: WorkflowSession) => {
    const cleanType = baseWorkflowType(s.type);
    const base = `/workflows/${cleanType}`;
    return s.leadId
      ? `${base}?leadId=${encodeURIComponent(s.leadId)}&sessionId=${encodeURIComponent(s.id)}`
      : `${base}?sessionId=${encodeURIComponent(s.id)}`;
  };

  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      const cleanType = baseWorkflowType(s.type);
      if (filterMode === 'foreclosures' && cleanType !== 'foreclosure-intake') {
        return false;
      }
      if (!q) return true;
      const draft = extractDraft(s);
      const haystack = [
        TYPE_LABELS[cleanType] || cleanType,
        s.status,
        s.leadName || '',
        s.dealTitle || '',
        draft.mortgagorName || '',
        draft.propertyAddress || '',
        draft.city || '',
        draft.county || '',
        draft.parcelId || '',
        draft.lawFirm || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sessions, query, filterMode]);

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              Saved Workflow &amp; Foreclosure Sessions
            </h2>
            <Tooltip>
              <TooltipTrigger>
                <span className="cursor-help text-muted-foreground text-xs">ⓘ</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  Search saved Foreclosure Intake notices, Offer Drafts, and Listing Entries by owner,
                  address, county, or parcel ID, or export all workspace foreclosure records as CSV.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                filterMode === 'all'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({sessions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('foreclosures')}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                filterMode === 'foreclosures'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              Foreclosures ({sessions.filter((s) => baseWorkflowType(s.type) === 'foreclosure-intake').length})
            </button>
            <a
              href="/api/export?entity=foreclosures"
              download
              className="rounded-lg border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Export Foreclosures CSV
            </a>
          </div>
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search saved sessions by mortgagor/owner, address, county, parcel ID, or workflow..."
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs"
        />

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading sessions...</div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-border rounded-xl p-4">
            {sessions.length === 0
              ? 'No saved workflow sessions yet. Launch Foreclosure Intake or Offer Draft above to capture and search records here.'
              : 'No saved sessions match your current search filter.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSessions.map((s) => {
              const cleanType = baseWorkflowType(s.type);
              const draft = extractDraft(s);
              const resolvedLeadName =
                s.leadName?.trim() ||
                (s.lead
                  ? `${s.lead.contact.firstName} ${s.lead.contact.lastName || ''}`.trim()
                  : '') ||
                draft.mortgagorName ||
                '';
              const addressSummary = [draft.propertyAddress, draft.city, draft.county ? `${draft.county} Co.` : '']
                .filter(Boolean)
                .join(', ');

              return (
                <div
                  key={s.id}
                  className="bg-background border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-foreground">
                        {TYPE_LABELS[cleanType] || cleanType}
                      </span>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          STATUS_COLORS[s.status] || 'bg-muted/15 text-muted-foreground'
                        }`}
                      >
                        {s.status}
                      </span>
                      {draft.parcelId && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          Parcel: {draft.parcelId}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {resolvedLeadName ? `Owner/Lead: ${resolvedLeadName}` : 'Unlinked draft'}
                      {addressSummary ? ` · ${addressSummary}` : ''}
                      {draft.saleDate ? ` · Sale: ${draft.saleDate}` : ''}
                      {' · Updated '}
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href={resumeHref(s)} className="text-xs text-primary hover:underline font-medium">
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => discard(s.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
