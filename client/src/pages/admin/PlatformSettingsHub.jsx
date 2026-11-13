import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Settings, Flag, ShieldCheck, HardDrive, RefreshCw, Key, Cloud, Database } from 'lucide-react';
import { format } from 'date-fns';

const PlatformSettingsHub = () => {
    const { tab } = useParams();
    const navigate = useNavigate();
    
    const [configs, setConfigs] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const activeTab = tab || 'overview';

    useEffect(() => {
        const fetchTree = async () => {
             if (!configs) setLoading(true);
             try {
                const [cfg, hist] = await Promise.all([
                    api.get('/admin/platform/config'),
                    api.get('/admin/platform/config/history')
                ]);
                setConfigs(cfg.data);
                setHistory(hist.data || []);
             } catch (e) {
                toast.error('Failed to load platform settings.');
             } finally {
                setLoading(false);
             }
        };
        fetchTree();
    }, []);

    const handleUpdate = async (key, payloadObj) => {
        try {
            await api.put('/admin/platform/config', { key, value: payloadObj });
            toast.success('Settings updated successfully!');
            setConfigs(prev => ({ ...prev, [key]: payloadObj }));
            
            // Refresh history explicitly
            const hist = await api.get('/admin/platform/config/history');
            setHistory(hist.data);
        } catch (e) {
            toast.error('Failed to update platform settings.');
        }
    };

    if (loading || !configs) return <div className="p-8 text-center animate-pulse tracking-widest text-muted-foreground uppercase font-black">Loading Platform Settings...</div>;

    const navTabs = [
        { id: 'overview', label: 'Overview', icon: ShieldCheck },
        { id: 'features', label: 'Feature Access', icon: Flag },
        { id: 'settings', label: 'System Settings', icon: Settings },
        { id: 'integrations', label: 'Integrations & Services', icon: HardDrive },
        { id: 'history', label: 'Settings History', icon: RefreshCw },
    ];

    return (
        <div className="space-y-6 animate-in fade-in">
           <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <h1 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-3">
                 <Settings className="text-blue-500 shrink-0" /> Platform Settings
              </h1>
              <div className="flex bg-surface-muted border border-border p-1 rounded-xl overflow-x-auto max-w-full">
                 {navTabs.map(t => {
                     const Icon = t.icon;
                     return (
                         <button 
                            key={t.id}
                            onClick={() => navigate(`/admin/platform/${t.id}`)}
                            className={`flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition ${activeTab === t.id ? 'bg-surface text-blue-500 shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}
                         >
                            <Icon size={16} className="shrink-0" /> <span>{t.label}</span>
                         </button>
                     );
                 })}
              </div>
           </div>

           <div className="bg-surface rounded-xl border border-border p-4 sm:p-6 shadow-sm">
               {activeTab === 'overview' && (
                  <div className="space-y-6">
                      <h2 className="text-lg font-black tracking-wide border-b border-border pb-4">Current Platform Status</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                          <div className="p-4 sm:p-5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                              <h3 className="text-xs uppercase tracking-widest font-black text-blue-500 mb-2">Live Site Mode</h3>
                              <p className="text-2xl font-black text-foreground">{configs.LAUNCH_SETTINGS?.launchMode ? 'LIVE' : 'OFF'}</p>
                          </div>
                          <div className="p-4 sm:p-5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                              <h3 className="text-xs uppercase tracking-widest font-black text-amber-500 mb-2">Maintenance Mode</h3>
                              <p className="text-2xl font-black text-foreground">{configs.LAUNCH_SETTINGS?.maintenanceMode ? 'ENABLED' : 'DISABLED'}</p>
                          </div>
                          <div className="p-4 sm:p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                              <h3 className="text-xs uppercase tracking-widest font-black text-emerald-500 mb-2">User Registration</h3>
                              <p className="text-2xl font-black text-foreground">{configs.LAUNCH_SETTINGS?.registrationEnabled ? 'OPEN' : 'CLOSED'}</p>
                          </div>
                          <div className="p-4 sm:p-5 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                              <h3 className="text-xs uppercase tracking-widest font-black text-purple-500 mb-2">Email Verification</h3>
                              <p className="text-2xl font-black text-foreground">{configs.AUTH_SETTINGS?.emailVerificationRequired ? 'REQUIRED' : 'OPTIONAL'}</p>
                          </div>
                      </div>
                  </div>
               )}

               {activeTab === 'features' && (
                  <div className="space-y-6">
                      <h2 className="text-lg font-black tracking-wide border-b border-border pb-4">Feature Access by Plan &amp; Role</h2>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                          {[
                            { key: 'aiChat', label: 'AI Chat (JAHZ AI)', desc: 'Interactive trade logging and coach chats', defaultVal: 'PRO_AND_ABOVE' },
                            { key: 'visionAi', label: 'Vision AI', desc: 'Screenshot chart pattern extraction and vision recognition', defaultVal: 'PRO_AND_ABOVE' },
                            { key: 'socialLogin', label: 'Social Login', desc: 'Google OAuth & third-party social logins', defaultVal: 'EVERYONE' },
                            { key: 'referrals', label: 'Referrals Program', desc: 'Affiliate links and invite commissions', defaultVal: 'EVERYONE' },
                            { key: 'mentorWorkspace', label: 'Mentor Workspace', desc: 'Cohorts, student rosters, feedback grading and curriculum', defaultVal: 'MENTOR_ALL' }
                          ].map(feature => (
                              <div key={feature.key || feature} className="p-4 border border-border rounded-xl bg-surface-muted/30 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                  <div className="min-w-0">
                                     <h3 className="font-bold text-foreground">{feature.label || feature}</h3>
                                     <p className="text-xs text-muted-foreground mt-1">{feature.desc || 'Control who has access to this feature'}</p>
                                  </div>
                                  <select 
                                     value={configs.FEATURES_CONFIG?.[feature.key || feature] || feature.defaultVal || 'EVERYONE'}
                                     onChange={(e) => {
                                        const newPayload = { ...configs.FEATURES_CONFIG, [feature.key || feature]: e.target.value };
                                        handleUpdate('FEATURES_CONFIG', newPayload);
                                     }}
                                     className="bg-surface border border-border px-3 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-bold text-blue-500 focus:border-blue-500 outline-none w-full sm:w-auto sm:max-w-[240px]"
                                  >
                                      <option value="EVERYONE">Enabled for Everyone</option>
                                      <option value="STARTER_AND_ABOVE">Starter &amp; Above</option>
                                      <option value="PRO_AND_ABOVE">Pro &amp; Above (Pro, Starter Sync, Pro Sync)</option>
                                      <option value="PRO_SYNC_ONLY">Pro Sync Only (MT4/MT5 Automated)</option>
                                      <option value="MENTOR_ALL">All Mentors (Private Cohort, Growth, Mega)</option>
                                      <option value="MEGA_MENTORS_ONLY">Mega Academy Mentors Only</option>
                                      <option value="PRO_ONLY">Pro Only</option>
                                      <option value="FOUNDING_TRADERS">Founding Traders Only</option>
                                      <option value="DISABLED">Disabled</option>
                                  </select>
                              </div>
                          ))}
                      </div>
                  </div>
               )}

               {activeTab === 'settings' && (
                  <div className="space-y-6">
                      <h2 className="text-lg font-black tracking-wide border-b border-border pb-4">Core Platform Settings</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                          <div className="space-y-4">
                              <h3 className="text-xs uppercase tracking-widest text-emerald-500 font-black">Site Availability</h3>
                              <label className="flex items-center gap-3 p-3 bg-surface-muted border border-border rounded-lg cursor-pointer">
                                  <input type="checkbox" checked={configs.LAUNCH_SETTINGS?.launchMode} onChange={e => handleUpdate('LAUNCH_SETTINGS', { ...configs.LAUNCH_SETTINGS, launchMode: e.target.checked })} className="accent-emerald-500 shrink-0" />
                                  <span className="text-sm font-bold">Platform Live (Launch Mode)</span>
                              </label>
                              <label className="flex items-center gap-3 p-3 bg-surface-muted border border-border rounded-lg cursor-pointer">
                                  <input type="checkbox" checked={configs.LAUNCH_SETTINGS?.maintenanceMode} onChange={e => handleUpdate('LAUNCH_SETTINGS', { ...configs.LAUNCH_SETTINGS, maintenanceMode: e.target.checked })} className="accent-emerald-500 shrink-0" />
                                  <span className="text-sm font-bold">Enable Maintenance Mode</span>
                              </label>
                          </div>
                          <div className="space-y-4">
                              <h3 className="text-xs uppercase tracking-widest text-purple-500 font-black">Security &amp; Authentication</h3>
                              <label className="flex items-center gap-3 p-3 bg-surface-muted border border-border rounded-lg cursor-pointer">
                                  <input type="checkbox" checked={configs.AUTH_SETTINGS?.emailVerificationRequired} onChange={e => handleUpdate('AUTH_SETTINGS', { ...configs.AUTH_SETTINGS, emailVerificationRequired: e.target.checked })} className="accent-purple-500 shrink-0" />
                                  <span className="text-sm font-bold">Require Email Verification for New Signups</span>
                              </label>
                              <label className="flex flex-col gap-1 p-3 bg-surface-muted border border-border rounded-lg">
                                  <span className="text-xs font-bold text-muted-foreground">Session Expiration (e.g. 24h, 7d)</span>
                                  <input type="text" value={configs.AUTH_SETTINGS?.sessionTimeout || '24h'} onChange={e => handleUpdate('AUTH_SETTINGS', { ...configs.AUTH_SETTINGS, sessionTimeout: e.target.value })} className="bg-surface px-3 py-2 border border-border rounded text-sm w-full outline-none" />
                              </label>
                          </div>
                      </div>
                  </div>
               )}

               {activeTab === 'integrations' && (
                  <div className="space-y-6">
                      <h2 className="text-lg font-black tracking-wide border-b border-border pb-4">Connected Services &amp; Integrations</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                         {[
                           { key: 'cloudinaryConnected', label: 'Cloudinary (Image Storage)', icon: Cloud },
                           { key: 'openrouterConnected', label: 'OpenRouter (AI Models)', icon: Key },
                           { key: 'paystackConnected', label: 'Paystack Payment Gateway', icon: ShieldCheck },
                           { key: 'redisActive', label: 'Redis Background Queue', icon: Database }
                         ].map(int => {
                             const Ico = int.icon;
                             const active = configs.INTEGRATIONS_CONFIG?.[int.key];
                             return (
                                <div key={int.key} className="flex flex-col items-center justify-center p-5 sm:p-6 border border-border rounded-xl text-center">
                                    <div className={`p-4 rounded-full mb-3 ${active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                        <Ico size={28} />
                                    </div>
                                    <h3 className="font-bold text-sm sm:text-base">{int.label}</h3>
                                    <div className={`text-xs font-black uppercase tracking-widest mt-2 ${active ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {active ? 'Connected' : 'Disconnected'}
                                    </div>
                                </div>
                             );
                         })}
                      </div>
                  </div>
               )}

               {activeTab === 'history' && (
                  <div className="space-y-6">
                      <h2 className="text-lg font-black tracking-wide border-b border-border pb-4">Settings Change History</h2>
                      <div className="space-y-3">
                         {history.map(h => (
                             <div key={h.id} className="p-4 rounded-xl border border-border bg-surface-muted flex flex-col md:flex-row justify-between md:items-center gap-4">
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-bold text-xs uppercase tracking-widest text-blue-500 break-words">{h.resourceId} changed by Admin ({h.adminId?.substring(0,6)})</h3>
                                    <div className="text-xs text-muted-foreground mt-2 font-mono break-all sm:truncate max-w-full md:max-w-xl">
                                        Before: {h.oldValue} 
                                        <br/>
                                        After: {h.newValue}
                                    </div>
                                </div>
                                <div className="text-xs font-bold text-muted-foreground whitespace-nowrap shrink-0">
                                    {format(new Date(h.createdAt), 'dd MMM yyyy, HH:mm')}
                                </div>
                             </div>
                         ))}
                      </div>
                  </div>
               )}
           </div>
        </div>
    );
};

export default PlatformSettingsHub;
