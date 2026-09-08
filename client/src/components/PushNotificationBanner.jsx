import React, { useState, useEffect } from 'react';
import { Bell, BellRing, X, Check, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { isPushNotificationSupported, getPushPermissionState, enablePushNotifications } from '../utils/pushNotificationHelper';
import api from '../utils/api';

export default function PushNotificationBanner() {
  const [permissionState, setPermissionState] = useState('granted'); // default to granted so it hides while checking
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function checkState() {
      if (isPushNotificationSupported()) {
        const state = await getPushPermissionState();
        setPermissionState(state);
        // If user already dismissed this session, don't auto show banner
        const sessionDismissed = sessionStorage.getItem('jahzjournal_push_banner_dismissed');
        if (sessionDismissed === 'true') {
          setDismissed(true);
        }
      }
    }
    checkState();
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      await enablePushNotifications();
      setPermissionState('granted');
      toast.success('🎉 Push notifications enabled! You will receive instant trade alerts and daily reminders.');
    } catch (err) {
      toast.error(err.message || 'Failed to enable push notifications.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    try {
      const res = await api.post('/push-notifications/send-test');
      toast.success(res.data.message || 'Test push notification sent!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send test push notification.');
    } finally {
      setTesting(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('jahzjournal_push_banner_dismissed', 'true');
  };

  if (!isPushNotificationSupported() || dismissed || permissionState === 'denied' || permissionState === 'granted') {
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
              Enable Web Push Notifications
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">Recommended</span>
            </h4>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              Get instant alerts for support ticket replies, SuperAdmin broadcasts, and automated <strong>Daily Trading Discipline Reminders</strong> right on your browser.
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
