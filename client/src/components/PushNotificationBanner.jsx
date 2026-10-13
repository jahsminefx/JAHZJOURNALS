import React, { useState, useEffect } from 'react';
import { Bell, BellRing, X, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  isPushNotificationSupported, 
  getPushPermissionState, 
  enablePushNotifications, 
  syncPushSubscription 
} from '../utils/pushNotificationHelper';

export default function PushNotificationBanner() {
  const [permissionState, setPermissionState] = useState('checking');
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function checkState() {
      if (isPushNotificationSupported()) {
        const state = await getPushPermissionState();
        setPermissionState(state);

        // If permission is already granted, silently ensure backend has this device subscribed
        if (state === 'granted') {
          syncPushSubscription().catch((err) => console.warn('Banner silent sync error:', err));
        }

        // If user already dismissed banner this session, don't show
        const sessionDismissed = sessionStorage.getItem('jahzjournal_push_banner_dismissed');
        if (sessionDismissed === 'true') {
          setDismissed(true);
        }
      } else {
        setPermissionState('unsupported');
      }
    }
    checkState();
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      await enablePushNotifications();
      setPermissionState('granted');
      toast.success('🎉 Push notifications enabled! You will now receive instant trade alerts and daily check-ins on your device.');
    } catch (err) {
      toast.error(err.message || 'Failed to enable push notifications.');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('jahzjournal_push_banner_dismissed', 'true');
  };

  // Only display if push is supported, not dismissed, and permission is 'default' (not yet asked)
  if (!isPushNotificationSupported() || dismissed || permissionState !== 'default') {
    return null;
  }

  return (
    <div className="relative mb-6 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 backdrop-blur-xs transition-all sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 rounded-lg bg-emerald-500/20 p-2.5 text-emerald-400 shrink-0">
            <BellRing className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              Enable Desktop & Mobile Notifications
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">Recommended</span>
            </h4>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              Receive instant alerts for <strong>MT4/MT5 trade syncs</strong>, <strong>support replies</strong>, and automated <strong>Daily Trading Discipline Reminders</strong> directly on your laptop and phone screen.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
          >
            Later
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleEnable}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-gray-950 hover:bg-emerald-400 transition-colors shadow-md shadow-emerald-500/10 disabled:opacity-60"
          >
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
            {loading ? 'Enabling...' : 'Enable Instant Notifications'}
          </button>
        </div>
      </div>
    </div>
  );
}
