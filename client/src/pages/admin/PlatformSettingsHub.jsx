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
             setLoading(true);
             try {
                const [cfg, hist] = await Promise.all([
                    api.get('/admin/platform/config'),
                    api.get('/admin/platform/config/history')
                ]);
                setConfigs(cfg.data);
                setHistory(hist.data);
             } catch (e) {
                toast.error('Failed synthesizing Config APIs.');
             } finally {
                setLoading(false);
             }
        };
        fetchTree();
    }, [activeTab]);

    const handleUpdate = async (key, payloadObj) => {
        try {
            await api.put('/admin/platform/config', { key, value: payloadObj });
            toast.success(`Platform Block [${key}] Synchronized Natively!`);
            setConfigs(prev => ({ ...prev, [key]: payloadObj }));
            
            // Refresh history explicitly
            const hist = await api.get('/admin/platform/config/history');
            setHistory(hist.data);
        } catch (e) {
            toast.error('Failed pushing mutation block to native nodes.');
        }
    };

    if (loading || !configs) return <div className="p-8 text-center animate-pulse tracking-widest text-muted-foreground uppercase font-black">Initializing Control Hub...</div>;

    const navTabs = [
        { id: 'overview', label: 'Platform Hub', icon: ShieldCheck },
        { id: 'features', label: 'Feature Flags', icon: Flag },
        { id: 'settings', label: 'System Settings', icon: Settings },
        { id: 'integrations', label: 'Integrations', icon: HardDrive },
        { id: 'history', label: 'Audit Trace', icon: RefreshCw },
    ];

    return (
        <div className="space-y-6 animate-in fade-in">
           <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <h1 className="text-2xl font-black text-foreground flex items-center gap-3">
                 <Settings className="text-blue-500" /> Platform Infrastructure
              </h1>
              <div className="flex bg-surface-muted border border-border p-1 rounded-xl">
                 {navTabs.map(t => {
                     const Icon = t.icon;
                     return (
                         <button 
                            key={t.id}
                            onClick={() => navigate(`/admin/platform/${t.id}`)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === t.id ? 'bg-surface text-blue-500 shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}
                         >
                            <Icon size={16} /> <span className="hidden sm:inline">{t.label}</span>
                         </button>
                     )
                 })}
              </div>
           </div>

           <div className="bg-surface rounded-xl border border-border p-6 shadow-sm">
               {activeTab === 'overview' && (
                  <div className="space-y-6">
                      <h2 className="text-lg font-black tracking-wide border-b border-border pb-4">Global Matrix Status</h2>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                          <div className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                              <h3 className="text-xs uppercase tracking-widest font-black text-blue-500 mb-2">Launch Mode</h3>
                              <p className="text-2xl font-black text-foreground">{configs.LAUNCH_SETTINGS?.launchMode ? 'ACTIVE' : 'OFF'}</p>
                          </div>
                          <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                              <h3 className="text-xs uppercase tracking-widest font-black text-amber-500 mb-2">Maintenance</h3>
                              <p className="text-2xl font-black text-foreground">{configs.LAUNCH_SETTINGS?.maintenanceMode ? 'ENABLED' : 'DISABLED'}</p>
                          </div>
                          <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                              <h3 className="text-xs uppercase tracking-widest font-black text-emerald-500 mb-2">Registration</h3>
                              <p className="text-2xl font-black text-foreground">{configs.LAUNCH_SETTINGS?.registrationEnabled ? 'OPEN' : 'LOCKED'}</p>
                          </div>
                          <div className="p-5 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                              <h3 className="text-xs uppercase tracking-widest font-black text-purple-500 mb-2">Auth Boundary</h3>
                              <p className="text-2xl font-black text-foreground">{configs.AUTH_SETTINGS?.emailVerificationRequired ? 'STRICT' : 'FLUID'}</p>
                          </div>
                      </div>
                  </div>
               )}

               {activeTab === 'features' && (
                  <div className="space-y-6">
                      <h2 className="text-lg font-black tracking-wide border-b border-border pb-4">Dynamic Role Arrays</h2>
                      <div className="grid md:grid-cols-2 gap-6">
                          {['aiChat', 'visionAi', 'socialLogin', 'referrals', 'mentorWorkspace'].map(feature => (
                              <div key={feature} className="p-4 border border-border rounded-xl bg-surface-muted/30 flex justify-between items-center">
                                  <div>
                                     <h3 className="font-bold text-foreground capitalize">{feature.replace(/([A-Z])/g, ' $1').trim()}</h3>
                                     <p className="text-xs text-muted-foreground mt-1">Cross-System Rollout String Hook</p>
                                  </div>
                                  <select 
                                     value={configs.FEATURES_CONFIG?.[feature] || 'EVERYONE'}
                                     onChange={(e) => {
                                        const newPayload = { ...configs.FEATURES_CONFIG, [feature]: e.target.value };
                                        handleUpdate('FEATURES_CONFIG', newPayload);
                                     }}
                                     className="bg-surface border border-border px-3 py-1.5 rounded-lg text-sm font-bold text-blue-500 focus:border-blue-500 outline-none"
                                  >
                                      <option value="EVERYONE">Enabled for Everyone</option>
                                      <option value="PRO_ONLY">PRO Only</option>
                                      <option value="FOUNDING_TRADERS">Founding Traders</option>
                                      <option value="DISABLED">Disabled</option>
                                  </select>
                              </div>
                          ))}
                      </div>
                  </div>
               )}

               {activeTab === 'settings' && (
                  <div className="space-y-6">
                      <h2 className="text-lg font-black tracking-wide border-b border-border pb-4">Core Operating Limits</h2>
                      <div className="grid md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                              <h3 className="text-xs uppercase tracking-widest text-emerald-500 font-black">Launch Defaults</h3>
                              <label className="flex items-center gap-3 p-3 bg-surface-muted border border-border rounded-lg">
                                  <input type="checkbox" checked={configs.LAUNCH_SETTINGS?.launchMode} onChange={e => handleUpdate('LAUNCH_SETTINGS', { ...configs.LAUNCH_SETTINGS, launchMode: e.target.checked })} className="accent-emerald-500" />
                                  <span className="text-sm font-bold">Trading Floor Online (Launch Mode)</span>
                              </label>
                              <label className="flex items-center gap-3 p-3 bg-surface-muted border border-border rounded-lg">
                                  <input type="checkbox" checked={configs.LAUNCH_SETTINGS?.maintenanceMode} onChange={e => handleUpdate('LAUNCH_SETTINGS', { ...configs.LAUNCH_SETTINGS, maintenanceMode: e.target.checked })} className="accent-emerald-500" />
                                  <span className="text-sm font-bold">Lock Architecture (Maintenance Mode)</span>
                              </label>
                          </div>
                          <div className="space-y-4">
                              <h3 className="text-xs uppercase tracking-widest text-purple-500 font-black">Authorization Boundaries</h3>
                              <label className="flex items-center gap-3 p-3 bg-surface-muted border border-border rounded-lg">
                                  <input type="checkbox" checked={configs.AUTH_SETTINGS?.emailVerificationRequired} onChange={e => handleUpdate('AUTH_SETTINGS', { ...configs.AUTH_SETTINGS, emailVerificationRequired: e.target.checked })} className="accent-purple-500" />
                                  <span className="text-sm font-bold">Require Email Verification Check</span>
                              </label>
                              <label className="flex flex-col gap-1 p-3 bg-surface-muted border border-border rounded-lg">
                                  <span className="text-xs font-bold text-muted-foreground">Session Expiration String</span>
                                  <input type="text" value={configs.AUTH_SETTINGS?.sessionTimeout || '24h'} onChange={e => handleUpdate('AUTH_SETTINGS', { ...configs.AUTH_SETTINGS, sessionTimeout: e.target.value })} className="bg-surface px-2 py-1 border border-border rounded text-sm w-full outline-none" />
                              </label>
                          </div>
                      </div>
                  </div>
               )}

               {activeTab === 'integrations' && (
                  <div className="space-y-6">
                      <h2 className="text-lg font-black tracking-wide border-b border-border pb-4">Native 3rd Party Bridges</h2>
                      <div className="grid md:grid-cols-3 gap-6">
                         {[
                           { key: 'cloudinaryConnected', label: 'Cloudinary CDN', icon: Cloud },
                           { key: 'openrouterConnected', label: 'OpenRouter AI Models', icon: Key },
                           { key: 'paystackConnected', label: 'Paystack Gateway', icon: ShieldCheck },
                           { key: 'redisActive', label: 'Redis BullMQ Cluster', icon: Database }
                         ].map(int => {
                             const Ico = int.icon;
                             const active = configs.INTEGRATIONS_CONFIG?.[int.key];
                             return (
                                <div key={int.key} className="flex flex-col items-center justify-center p-6 border border-border rounded-xl text-center">
                                    <div className={`p-4 rounded-full mb-3 ${active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                        <Ico size={32} />
                                    </div>
                                    <h3 className="font-bold">{int.label}</h3>
                                    <div className={`text-xs font-black uppercase tracking-widest mt-2 ${active ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {active ? 'Bridge Active' : 'Offline'}
                                    </div>
                                </div>
                             )
                         })}
                      </div>
                  </div>
               )}

               {activeTab === 'history' && (
                  <div className="space-y-6">
                      <h2 className="text-lg font-black tracking-wide border-b border-border pb-4">Immutable Configuration Diffs</h2>
                      <div className="space-y-3">
                         {history.map(h => (
                             <div key={h.id} className="p-4 rounded-xl border border-border bg-surface-muted flex flex-col md:flex-row justify-between md:items-center gap-4">
                                <div>
                                    <h3 className="font-bold text-xs uppercase tracking-widest text-blue-500">{h.resourceId} mutated by Node #{h.adminId?.substring(0,6)}</h3>
                                    <div className="text-xs text-muted-foreground mt-2 font-mono truncate max-w-full md:max-w-xl">
                                        [PREV]: {h.oldValue} 
                                        <br/>
                                        [NEW]: {h.newValue}
                                    </div>
                                </div>
                                <div className="text-xs font-bold text-muted-foreground whitespace-nowrap">
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
