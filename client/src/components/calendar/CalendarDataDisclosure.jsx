import React, { useState } from 'react';
import { ShieldAlert, Info, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { CALENDAR_CONFIG } from '../../config/calendarConfig';

export default function CalendarDataDisclosure() {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div
      role="region"
      aria-label="Economic Calendar Data and Timing Disclosure"
      className="rounded-2xl border border-border bg-surface dark:bg-white/[0.03] p-4 sm:p-5 shadow-sm text-foreground transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5">
            <ShieldAlert size={18} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2 flex-wrap">
              <span>Data Source & Timing Disclosure</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Planning Notice
              </span>
            </h2>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {CALENDAR_CONFIG.timingNotice}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-semibold text-muted hover:text-foreground flex items-center gap-1 shrink-0 p-1 rounded-lg hover:bg-surface-muted transition-colors cursor-pointer"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse disclosure details' : 'Expand disclosure details'}
        >
          <span>{isExpanded ? 'Less' : 'Details'}</span>
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-3.5 border-t border-border grid gap-3 text-xs text-muted leading-relaxed sm:grid-cols-2">
          <div className="space-y-2">
            <div>
              <span className="font-bold text-foreground">Data Sources:</span>{' '}
              Economic schedules and consensus forecasts are sourced via{' '}
              <strong className="text-foreground">{CALENDAR_CONFIG.sources.schedule.name}</strong>, with live actuals and revision tracking via{' '}
              <strong className="text-foreground">{CALENDAR_CONFIG.sources.actuals.name}</strong>.
            </div>
            <div>
              <span className="font-bold text-foreground">Refresh Policy:</span>{' '}
              {CALENDAR_CONFIG.refreshPolicy.scheduleInterval}. {CALENDAR_CONFIG.refreshPolicy.actualsInterval}. {CALENDAR_CONFIG.refreshPolicy.clientInterval}.
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <span className="font-bold text-foreground">Delays & Revisions:</span>{' '}
              {CALENDAR_CONFIG.accuracyNotice}
            </div>
            <div>
              <span className="font-bold text-foreground">Verification & Disclaimer:</span>{' '}
              {CALENDAR_CONFIG.verificationNotice}{' '}
              <span className="text-amber-500/90 dark:text-amber-400/90 font-medium">{CALENDAR_CONFIG.financialDisclaimer}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
