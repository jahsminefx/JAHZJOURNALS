import React, { useState, useEffect } from 'react';
import { Megaphone, X, ExternalLink, AlertTriangle, Info, Bell } from 'lucide-react';
import api from '../utils/api';

const AnnouncementBanner = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dismissed_announcements') || '[]');
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await api.get('/announcements');
      if (Array.isArray(res.data)) {
        setAnnouncements(res.data);
      }
    } catch (error) {
      console.error('Error fetching announcements banner:', error);
    }
  };

  const handleDismiss = (id) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      localStorage.setItem('dismissed_announcements', JSON.stringify(updated));
    } catch (e) {}
  };

  const activeAnnouncements = announcements.filter(a => !dismissedIds.includes(a.id));

  if (activeAnnouncements.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {activeAnnouncements.map((a) => {
        const isUrgent = a.priority === 'URGENT';
        const isHigh = a.priority === 'HIGH';

        const borderColor = isUrgent 
          ? 'border-rose-500/40 bg-rose-950/20' 
          : isHigh 
          ? 'border-amber-500/40 bg-amber-950/20' 
          : 'border-emerald-500/40 bg-emerald-950/20';

        const iconColor = isUrgent ? 'text-rose-400' : isHigh ? 'text-amber-400' : 'text-emerald-400';

        return (
          <div
            key={a.id}
            className={`relative flex items-start gap-4 p-4 sm:p-5 rounded-2xl border ${borderColor} backdrop-blur-md transition-all shadow-lg shadow-black/20 group`}
          >
            {/* Megaphone Icon Badge */}
            <div className={`h-10 w-10 rounded-xl bg-surface-muted/80 flex items-center justify-center shrink-0 border border-border/50 ${iconColor}`}>
              {isUrgent ? <AlertTriangle className="w-5 h-5" /> : <Megaphone className="w-5 h-5" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-8">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isUrgent 
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                    : isHigh 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  {a.priority || 'ANNOUNCEMENT'}
                </span>
                <h4 className="text-sm sm:text-base font-bold text-foreground truncate">
                  {a.title}
                </h4>
              </div>

              <p className="text-xs sm:text-sm text-muted/90 leading-relaxed whitespace-pre-wrap">
                {a.content}
              </p>

              {a.actionUrl && (
                <div className="mt-3">
                  <a
                    href={a.actionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Learn More
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={() => handleDismiss(a.id)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-muted/80 transition-colors"
              title="Dismiss Announcement"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default AnnouncementBanner;
