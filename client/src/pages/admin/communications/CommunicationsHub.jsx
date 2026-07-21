import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mail, Megaphone, Bell, Mailbox, FileText, BarChart2, Settings } from 'lucide-react';
import PageHeader from '../../../components/PageHeader';

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
    <div className="space-y-6">
      <PageHeader 
        title="Enterprise Communications Hub" 
        subtitle="Manage contact messages, announcements, global notifications, and email campaigns from one place."
      />

      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-sm">
        {/* Hub Navigation Tabs */}
        <div className="flex overflow-x-auto border-b border-gray-700 hide-scrollbar">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            
            return (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  isActive 
                  ? 'border-indigo-500 text-indigo-400 bg-gray-700/30' 
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                }`}
              >
                <Icon size={18} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Content Loading Box */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-sm min-h-[600px] p-6 lg:p-8 relative">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default CommunicationsHub;
