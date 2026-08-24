import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { LineChart, BarChart2, PieChart, Users, DollarSign, BrainCircuit, Activity, Download, Eye } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { generateBusinessIntelligencePdfReport } from '../../utils/pdfReportService';

const BusinessIntelligenceHub = () => {
    const { tab } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    
    const [execData, setExecData] = useState(null);
    const [tradeData, setTradeData] = useState(null);
    const [aiData, setAiData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exportingPdf, setExportingPdf] = useState(false);

    const activeTab = location.pathname.includes('/analytics') ? 'trading' : (tab || 'executive');

    useEffect(() => {
        const pullAnalytics = async () => {
            setLoading(true);
            try {
                if (activeTab === 'executive' && !execData) {
                    const res = await api.get('/admin/business/executive');
                    setExecData(res.data);
                }
                if (activeTab === 'trading' && !tradeData) {
                    const res = await api.get('/admin/business/trading');
                    setTradeData(res.data);
                }
                if (activeTab === 'ai' && !aiData) {
                    const res = await api.get('/admin/business/ai');
                    setAiData(res.data);
                }
            } catch (e) {
                console.error('Analytics Fetch Error:', e);
                toast.error(e.response?.data?.message || e.response?.data?.error || 'Failed to load analytics telemetry data.');
            } finally {
                setLoading(false);
            }
        };
        pullAnalytics();
    }, [activeTab]);

    const handleExportBiPdf = async () => {
        if (user?.role !== 'SUPER_ADMIN') {
            toast.error('Business Intelligence PDF exports are restricted strictly to Super Admins.');
            return;
        }

        try {
            setExportingPdf(true);
            toast.loading('Generating Executive BI Report...', { id: 'bi-pdf' });
            
            // Ensure exec & trade data are loaded
            let currentExec = execData;
            let currentTrade = tradeData;
            if (!currentExec) {
               const resExec = await api.get('/admin/business/executive');
               currentExec = resExec.data;
               setExecData(currentExec);
            }
            if (!currentTrade) {
               const resTrade = await api.get('/admin/business/trading');
               currentTrade = resTrade.data;
               setTradeData(currentTrade);
            }

            await generateBusinessIntelligencePdfReport({
                user,
                execData: currentExec,
                tradeData: currentTrade,
                aiData
            });

            toast.success('Executive BI PDF report generated successfully!', { id: 'bi-pdf' });
        } catch (err) {
            console.error(err);
            toast.error('Failed to generate BI PDF report.', { id: 'bi-pdf' });
        } finally {
            setExportingPdf(false);
        }
    };

    const navTabs = [
        { id: 'executive', label: 'Executive Dashboard', icon: LineChart },
        { id: 'trading', label: 'Trading Analytics', icon: BarChart2 },
        { id: 'ai', label: 'AI Intelligence', icon: BrainCircuit },
        { id: 'revenue', label: 'Revenue Trends', icon: DollarSign },
        { id: 'exports', label: 'Export Center', icon: Download },
    ];

    if (loading && !execData && !tradeData && !aiData && (activeTab === 'executive' || activeTab === 'trading' || activeTab === 'ai')) return (
       <div className="flex justify-center p-20 animate-pulse text-amber-500 font-bold uppercase tracking-widest text-sm">Loading Business Intelligence...</div>
    );

    return (
        <div className="space-y-6 animate-in fade-in">
           <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <h1 className="text-2xl font-black text-foreground flex items-center gap-3">
                 <LineChart className="text-amber-500" /> Business Intelligence
              </h1>
              <div className="flex bg-surface-muted border border-border p-1 rounded-xl overflow-x-auto whitespace-nowrap scrollbar-hide w-full sm:w-auto">
                 {navTabs.map(t => {
                     const Icon = t.icon;
                     return (
                         <button 
                            key={t.id}
                            onClick={() => navigate(`/admin/business/${t.id}`)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === t.id ? 'bg-surface text-amber-500 shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}
                         >
                            <Icon size={16} /> <span className="hidden sm:inline">{t.label}</span>
                         </button>
                     )
                 })}
              </div>
           </div>

           <div className="bg-surface rounded-xl border border-border p-6 shadow-sm min-h-[500px]">
               {activeTab === 'executive' && execData && (
                  <div className="space-y-6">
                      <h2 className="text-lg font-black tracking-wide border-b border-border pb-4 flex items-center gap-2"><Activity size={20}/> Platform Health Matrix</h2>
                      
                      <div className="grid md:grid-cols-3 gap-6">
                          <div className="bg-surface border border-border p-5 rounded-xl">
                              <h3 className="text-xs uppercase tracking-widest font-black text-muted-foreground flex items-center gap-2 mb-4"><Users size={14}/> User Aggregations</h3>
                              <p className="text-3xl font-black">{execData.platformHealth.totalUsers}</p>
                              <p className="text-[10px] text-emerald-500 font-bold uppercase mt-1">+{execData.platformHealth.newRegistrationsLast7Days} Last 7 Days</p>
                              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">Founding Traders: <span className="font-bold text-foreground">{execData.platformHealth.activeFounders}</span></p>
                          </div>
                          
                          <div className="bg-surface border border-border p-5 rounded-xl border-t-4 border-t-amber-500">
                              <h3 className="text-xs uppercase tracking-widest font-black text-amber-500 flex items-center gap-2 mb-4"><LineChart size={14}/> Product Operations</h3>
                              <div className="space-y-2">
                                 <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                                     <span className="text-muted-foreground font-bold">Total Trades Executed</span>
                                     <span className="font-black">{execData.productUsage.totalTradesLogged}</span>
                                 </div>
                                 <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                                     <span className="text-muted-foreground font-bold">Total AI Transmissions</span>
                                     <span className="font-black">{execData.productUsage.totalAiRequests}</span>
                                 </div>
                                 <div className="flex justify-between items-center text-sm">
                                     <span className="text-muted-foreground font-bold">Open Support Nodes</span>
                                     <span className="font-black">{execData.productUsage.openSupportTickets}</span>
                                 </div>
                              </div>
                          </div>

                          <div className="bg-surface border border-border p-5 rounded-xl bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] relative overflow-hidden">
                              <div className="absolute inset-0 bg-blue-500/5 mix-blend-overlay pointer-events-none"></div>
                              <h3 className="text-xs uppercase tracking-widest font-black text-blue-500 flex items-center gap-2 mb-4 relative"><DollarSign size={14}/> Capital Flow</h3>
                              <p className="text-3xl font-black relative">{execData.revenue.mrrText} <span className="text-xs text-muted-foreground">MRR</span></p>
                              <p className="text-xl font-bold text-muted-foreground relative">{execData.revenue.arrText} <span className="text-[10px] text-muted-foreground">ARR</span></p>
                              <div className="mt-4 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 text-amber-500 text-[10px] uppercase font-black tracking-widest relative">
                                  {execData.revenue.status}
                              </div>
                          </div>
                      </div>
                  </div>
               )}

               {activeTab === 'trading' && tradeData && (
                  <div className="space-y-6">
                      <h2 className="text-lg font-black tracking-wide border-b border-border pb-4">Trading Structural Intelligence & Recent Trades</h2>
                      <div className="grid md:grid-cols-2 gap-8">
                          <div className="p-6 bg-surface-muted border border-border rounded-xl">
                              <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground mb-4">Total Efficacy Matrix</h3>
                              <div className="flex justify-between items-end border-b border-border pb-4">
                                  <div>
                                      <p className="text-3xl font-black text-foreground">{tradeData.globalMetrics.totalTrades}</p>
                                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Global Positions</p>
                                  </div>
                                  <div className="text-right">
                                      <p className="text-3xl font-black text-emerald-500">{tradeData.globalMetrics.winRate}</p>
                                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Aggregated Efficacy</p>
                                  </div>
                              </div>
                              <div className="mt-4 pt-2 flex items-center justify-between text-xs font-bold text-muted-foreground">
                                  <span>WIN: <strong className="text-emerald-500">{tradeData.globalMetrics.winningTrades || 0}</strong></span>
                                  <span>LOSS: <strong className="text-rose-500">{tradeData.globalMetrics.losingTrades || 0}</strong></span>
                                  <span>BREAKEVEN: <strong className="text-amber-500">{tradeData.globalMetrics.breakEvenTrades || 0}</strong></span>
                              </div>
                          </div>
                          
                          <div>
                              <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground mb-4">Volume Distribution Vectors (Pairs)</h3>
                              <div className="space-y-3">
                                  {tradeData.mostTradedPairs.map((p, i) => (
                                     <div key={i} className="flex justify-between items-center p-3 rounded-lg border border-border bg-surface relative overflow-hidden group">
                                         <span className="font-black z-10">{p.asset}</span>
                                         <span className="font-mono text-muted-foreground z-10">{p.count} Trades</span>
                                         <div className="absolute left-0 bottom-0 top-0 bg-blue-500/5 transition-all group-hover:bg-blue-500/10" style={{ width: `${Math.min(100, (p.count/tradeData.globalMetrics.totalTrades)*100)}%`}}></div>
                                     </div>
                                  ))}
                              </div>
                          </div>
                      </div>

                      {/* Recent Platform Trades Inspection Table */}
                      <div className="pt-6 border-t border-border space-y-4">
                          <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground">Global Live Trade Feed</h3>
                          {tradeData.recentTrades && tradeData.recentTrades.length > 0 ? (
                              <div className="overflow-x-auto border border-border rounded-xl">
                                  <table className="w-full text-left text-xs">
                                      <thead className="bg-surface-muted border-b border-border uppercase font-extrabold text-muted-foreground">
                                          <tr>
                                              <th className="p-3">Trader</th>
                                              <th className="p-3">Account</th>
                                              <th className="p-3">Pair</th>
                                              <th className="p-3">Type</th>
                                              <th className="p-3">Result</th>
                                              <th className="p-3 text-right">P&L</th>
                                              <th className="p-3 text-right">Date</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border">
                                          {tradeData.recentTrades.map((t) => (
                                              <tr key={t.id} className="hover:bg-surface-muted/50 transition">
                                                  <td className="p-3 font-bold text-foreground">
                                                      {t.tradingAccount?.user?.name || 'Trader'}
                                                      <div className="text-[10px] text-muted-foreground font-normal">{t.tradingAccount?.user?.email}</div>
                                                  </td>
                                                  <td className="p-3 text-muted-foreground font-medium">{t.tradingAccount?.name || 'Account'} {t.tradingAccount?.brokerName ? `(${t.tradingAccount.brokerName})` : ''}</td>
                                                  <td className="p-3 font-extrabold text-foreground">{t.pair}</td>
                                                  <td className="p-3">
                                                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${t.direction === 'BUY' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'}`}>
                                                          {t.direction}
                                                      </span>
                                                  </td>
                                                  <td className="p-3">
                                                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${t.result === 'WIN' ? 'bg-emerald-500/15 text-emerald-500' : t.result === 'LOSS' ? 'bg-rose-500/15 text-rose-500' : 'bg-amber-500/15 text-amber-500'}`}>
                                                          {t.result || 'OPEN'}
                                                      </span>
                                                  </td>
                                                  <td className={`p-3 text-right font-mono font-bold ${Number(t.pnl) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                      {t.pnl !== null ? `${Number(t.pnl) >= 0 ? '+' : ''}$${Number(t.pnl).toFixed(2)}` : '-'}
                                                  </td>
                                                  <td className="p-3 text-right text-muted-foreground text-[10px]">{new Date(t.createdAt).toLocaleDateString()}</td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          ) : (
                              <p className="text-xs text-muted-foreground py-4">No trades recorded yet across the platform.</p>
                          )}
                      </div>
                  </div>
               )}

               {activeTab === 'revenue' && (
                  <div className="flex flex-col items-center justify-center py-20">
                     <DollarSign size={64} className="text-amber-500/20 mb-6" />
                     <h2 className="text-xl font-black uppercase tracking-widest text-muted-foreground mb-2">[ AWAITING_TELEMETRY ]</h2>
                     <p className="text-sm font-bold text-muted-foreground text-center max-w-md">Realtime Live-Billing aggregation paths require Phase 9 execution of native Stripe webhooks spanning the DB boundaries inherently.</p>
                  </div>
               )}
               
               {activeTab === 'ai' && aiData && (
                  <div className="space-y-6">
                      <h2 className="text-lg font-black tracking-wide border-b border-border pb-4">Neural Abstraction Costs</h2>
                      <div className="grid md:grid-cols-2 gap-8">
                         <div>
                             <p className="text-3xl font-black text-foreground">{aiData.overview.totalRequests}</p>
                             <p className="text-xs uppercase font-bold text-muted-foreground tracking-widest">Total Global Generation Prompts</p>
                             <div className="mt-4">
                                <p className="text-xs text-muted-foreground font-mono">Tokens Burned: <span className="font-black text-purple-500">{aiData.overview.totalTokensBurned}</span></p>
                             </div>
                         </div>
                         <div className="space-y-2">
                             <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Feature Adoption Load</h3>
                             {aiData.featureDistribution.map((feat, i) => (
                                 <div key={i} className="flex justify-between items-center p-2 rounded bg-surface border border-border text-xs font-bold">
                                     <span className="uppercase tracking-wide text-purple-500">{feat.feature}</span>
                                     <span className="font-mono text-muted-foreground">{feat.hits}</span>
                                 </div>
                             ))}
                         </div>
                      </div>
                  </div>
               )}

               {activeTab === 'exports' && (
                  <div className="space-y-6">
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-4">
                        <div>
                           <h2 className="text-lg font-black tracking-wide">Executive Intelligence Export Center</h2>
                           <p className="text-xs text-muted-foreground mt-0.5">Generate and download official PDF platform reports for governance, auditing, and executive review.</p>
                        </div>
                        <button
                           type="button"
                           onClick={handleExportBiPdf}
                           disabled={exportingPdf}
                           className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-gray-950 font-extrabold rounded-xl text-xs flex items-center gap-2 transition shadow-md disabled:opacity-50"
                        >
                           <Download size={16} />
                           <span>{exportingPdf ? 'Exporting PDF...' : 'Export Executive BI PDF Report'}</span>
                        </button>
                     </div>

                     <div className="p-6 bg-surface-muted/40 border border-border rounded-xl space-y-4">
                        <div className="flex items-center gap-3 text-amber-500 font-bold text-sm">
                           <Activity size={18} /> Executive Report Scope
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
                           <li>Platform User Aggregations & Active Founder Counts</li>
                           <li>Product Operations: Logged Trades & AI Request Volumes</li>
                           <li>Live Platform Trade Feed & Efficacy Win Rates</li>
                           <li>MRR / ARR Financial Flow Metrics</li>
                        </ul>
                     </div>
                  </div>
               )}
           </div>
        </div>
    );
};

export default BusinessIntelligenceHub;
