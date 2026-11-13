import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mail, Megaphone, Bell, Mailbox, FileText, BarChart2, Settings, MessageSquare } from 'lucide-react';

// Tab Components
import ContactMessagesTab from './ContactMessagesTab';
import AnnouncementsTab from './AnnouncementsTab';
import NotificationCenterTab from './NotificationCenterTab';
import EmailCampaignsTab from './EmailCampaignsTab';
import TemplatesTab from './TemplatesTab';
import AnalyticsTab from './AnalyticsTab';
import SettingsTab from './SettingsTab';

const CommunicationsHub = () => {
  const { tab } = useParams();
  const navigate = useNavigate();

  const activeTab = tab || 'contact';

  const tabs = [
    { id: 'contact', label: 'Contact Messages', icon: Mail },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'notifications', label: 'Notification Center', icon: Bell },
    { id: 'emails', label: 'Email Campaigns', icon: Mailbox },
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const handleTabChange = (tabId) => {
    navigate(`/admin/communications/${tabId}`);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'contact':
        return <ContactMessagesTab />;
      case 'announcements':
        return <AnnouncementsTab />;
      case 'notifications':
        return <NotificationCenterTab />;
      case 'emails':
        return <EmailCampaignsTab />;
      case 'templates':
        return <TemplatesTab />;
      case 'analytics':
        return <AnalyticsTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <ContactMessagesTab />;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2.5">
            <MessageSquare size={22} className="text-indigo-500 shrink-0" />
            <span>Communications Hub</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage contact messages, announcements, global notifications, and email campaigns from one place.
          </p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        {/* Hub Navigation Tabs */}
        <div className="flex overflow-x-auto border-b border-border hide-scrollbar">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            
            return (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`flex items-center gap-2 px-4 sm:px-5 py-3.5 min-h-[44px] text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  isActive 
                  ? 'border-indigo-500 text-indigo-500 dark:text-indigo-400 bg-indigo-500/10' 
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-surface-muted'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Content Loading Box */}
      <div className="bg-surface border border-border rounded-xl shadow-sm min-h-[500px] p-3 sm:p-6 relative">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default CommunicationsHub;
