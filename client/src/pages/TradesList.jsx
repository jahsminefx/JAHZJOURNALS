import React, { useCallback, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlusCircle, Search, Trash2, Download, LayoutList, LayoutGrid, List } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import DeleteTradeDialog from '../components/trades/DeleteTradeDialog';
import ImportTradesModal from '../components/trades/ImportTradesModal';
import { SkeletonTable, SkeletonCard } from '../components/SkeletonLoader';
import { loadSettings, fetchAndSyncSettings } from '../utils/settings';

const TradesList = () => {
  const [searchParams] = useSearchParams();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingTradeId, setDeletingTradeId] = useState(null);
  const [tradePendingDelete, setTradePendingDelete] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState(() => (loadSettings().journal?.defaultTradeListView || 'table').toLowerCase());

  const queryString = searchParams.toString();
  const pairFilter = searchParams.get('pair');
  const dateFilter = searchParams.get('date');

  useEffect(() => {
    fetchAndSyncSettings().then((synced) => {
      if (synced?.journal?.defaultTradeListView) {
        setViewMode(synced.journal.defaultTradeListView.toLowerCase());
      }
    });
  }, []);

  const fetchTrades = useCallback(async () => {
    try {
      setLoading(true);
      const params = Object.fromEntries(new URLSearchParams(queryString).entries());
      const { data } = await api.get('/trades', { params });
      setTrades(data);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Couldn\'t load your trades right now.');
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const deleteTrade = async () => {
    const trade = tradePendingDelete;
    if (!trade || deletingTradeId) return;

    setDeletingTradeId(trade.id);
    try {
      await api.delete(`/trades/${trade.id}`);
      setTrades((current) => current.filter((item) => item.id !== trade.id));
      setTradePendingDelete(null);
      toast.success('Trade removed from your journal.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Couldn\'t remove that trade. Try again.');
    } finally {
      setDeletingTradeId(null);
    }
  };

  const filteredTrades = trades.filter((t) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.pair?.toLowerCase().includes(term) ||
      t.notes?.toLowerCase().includes(term) ||
      t.direction?.toLowerCase().includes(term) ||
      t.session?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 text-foreground font-sans">
      {/* Top Action & Filter Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-surface p-5 sm:p-6 rounded-2xl border border-border gap-4 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-black">Your Trade Journal</h2>
          <p className="text-xs sm:text-sm text-muted mt-1">
            {pairFilter || dateFilter
              ? `Filtered by ${pairFilter ? `pair ${pairFilter}` : ''}${pairFilter && dateFilter ? ' and ' : ''}${dateFilter ? `date ${dateFilter}` : ''}`
              : 'Your executions, your lessons, your growth'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {(pairFilter || dateFilter) && (
            <Link to="/trades" className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted hover:border-emerald-500/60 hover:text-foreground">
              Clear Filter
            </Link>
          )}

          {/* View Mode Toggle Controls */}
          <div className="flex items-center rounded-xl border border-border bg-surface-muted/60 p-1">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'table' ? 'bg-surface text-emerald-400 shadow-xs' : 'text-muted hover:text-foreground'
              }`}
              title="Table View"
            >
              <LayoutList size={15} />
              <span className="hidden lg:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'cards' ? 'bg-surface text-emerald-400 shadow-xs' : 'text-muted hover:text-foreground'
              }`}
              title="Cards View"
            >
              <LayoutGrid size={15} />
              <span className="hidden lg:inline">Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === 'compact' ? 'bg-surface text-emerald-400 shadow-xs' : 'text-muted hover:text-foreground'
              }`}
              title="Compact View"
            >
              <List size={15} />
              <span className="hidden lg:inline">Compact</span>
            </button>
          </div>

          <div className="relative flex-1 min-w-[160px] md:w-48">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" size={16} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search pair, notes..." 
              className="w-full bg-surface-muted/60 border border-border rounded-xl py-2 pl-9 pr-3 text-xs sm:text-sm focus:border-emerald-500 focus:outline-none transition-colors" 
            />
          </div>

          <button 
            onClick={() => setShowImport(true)} 
            className="whitespace-nowrap flex items-center px-3 py-2 bg-surface-muted text-foreground font-semibold rounded-xl hover:bg-surface-muted/80 transition-colors border border-border text-xs"
          >
            Import CSV
          </button>
          
          <button 
            onClick={() => window.open(`${api.defaults.baseURL}/trades/export-csv?${queryString}`, '_blank')} 
            className="whitespace-nowrap flex items-center px-3 py-2 bg-surface-muted text-foreground font-semibold rounded-xl hover:bg-surface-muted/80 transition-colors border border-border text-xs"
          >
            <Download size={14} className="mr-1.5" /> Export
          </button>

          <Link 
            to="/trades/new" 
            className="whitespace-nowrap flex items-center px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow-sm text-xs"
          >
            <PlusCircle size={16} className="mr-1.5" />
            Log Trade
          </Link>
        </div>
      </div>

      {/* Main Trade Content Container */}
      {loading ? (
        <div className="space-y-3">
          <div className="hidden sm:block"><SkeletonTable rows={5} /></div>
          <div className="sm:hidden space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      ) : filteredTrades.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center text-muted">
          <p className="text-sm font-medium">No trades found. Every journey starts with the first entry.</p>
        </div>
      ) : (
        <>
          {/* CARDS VIEW MODE */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTrades.map((trade) => (
                <div 
                  key={trade.id} 
                  className="bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-xs hover:border-emerald-500/30 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-lg font-black text-foreground">{trade.pair}</span>
                        <span className={`ml-2 px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          trade.direction === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                        }`}>
                          {trade.direction}
                        </span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${
                        trade.result === 'WIN' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                        trade.result === 'LOSS' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 
                        'bg-surface-muted text-muted'
                      }`}>
                        {trade.result}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs text-muted bg-surface-muted/50 p-3 rounded-xl">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-muted">Date</span>
                        <span className="font-semibold text-foreground">{new Date(trade.entryTime || trade.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-muted">P/L</span>
                        <span className={`font-mono font-bold ${
                          trade.profitLossAmount > 0 ? 'text-emerald-400' : trade.profitLossAmount < 0 ? 'text-rose-400' : 'text-muted'
                        }`}>
                          {trade.profitLossAmount > 0 ? '+' : ''}${trade.profitLossAmount || 0}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-muted">R:R</span>
                        <span className="font-medium text-foreground">{trade.riskRewardRatio || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-muted">Session</span>
                        <span className="font-medium text-foreground">{trade.session || 'N/A'}</span>
                      </div>
                    </div>

                    {trade.notesBefore && (
                      <p className="text-xs text-muted italic line-clamp-2 mt-3 bg-surface-muted/30 p-2 rounded-lg">"{trade.notesBefore}"</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <div className="flex items-center gap-3 text-xs">
                      <Link to={`/trades/${trade.id}`} className="text-indigo-400 hover:text-indigo-300 font-bold">Details</Link>
                      <Link to={`/trades/${trade.id}/edit`} className="text-emerald-400 hover:text-emerald-300 font-bold">Edit</Link>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setTradePendingDelete(trade)} 
                      disabled={deletingTradeId === trade.id}
                      className="text-rose-400 hover:text-rose-300 text-xs font-semibold"
                    >
                      {deletingTradeId === trade.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* COMPACT VIEW MODE */}
          {viewMode === 'compact' && (
            <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden shadow-xs">
              {filteredTrades.map((trade) => (
                <div key={trade.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 hover:bg-surface-muted/40 transition-colors gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                      trade.direction === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                    }`}>
                      {trade.direction}
                    </span>
                    <div>
                      <p className="font-bold text-sm text-foreground">{trade.pair}</p>
                      <p className="text-xs text-muted">{new Date(trade.entryTime || trade.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      trade.result === 'WIN' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                      trade.result === 'LOSS' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 
                      'bg-surface-muted text-muted'
                    }`}>
                      {trade.result}
                    </span>
                    <span className={`font-mono font-bold text-sm ${
                      trade.profitLossAmount > 0 ? 'text-emerald-400' : trade.profitLossAmount < 0 ? 'text-rose-400' : 'text-muted'
                    }`}>
                      {trade.profitLossAmount > 0 ? '+' : ''}${trade.profitLossAmount || 0}
                    </span>

                    <div className="flex items-center gap-2 text-xs">
                      <Link to={`/trades/${trade.id}`} className="text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-1 rounded-md hover:bg-surface-muted">Details</Link>
                      <Link to={`/trades/${trade.id}/edit`} className="text-emerald-400 hover:text-emerald-300 font-semibold px-2 py-1 rounded-md hover:bg-surface-muted">Edit</Link>
                      <button 
                        type="button" 
                        onClick={() => setTradePendingDelete(trade)} 
                        disabled={deletingTradeId === trade.id}
                        className="text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 rounded-md hover:bg-surface-muted"
                      >
                        {deletingTradeId === trade.id ? 'Removing...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TABLE VIEW MODE (DEFAULT) */}
          {viewMode === 'table' && (
            <>
              {/* Mobile Stacked Trade Cards (<640px) */}
              <div className="sm:hidden space-y-3">
                {filteredTrades.map((trade) => (
                  <div 
                    key={trade.id}
                    className="bg-surface border border-border rounded-2xl p-4 space-y-3 shadow-xs hover:border-border/80 transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-foreground">{trade.pair}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          trade.direction === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                        }`}>
                          {trade.direction}
                        </span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${
                        trade.result === 'WIN' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                        trade.result === 'LOSS' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 
                        'bg-surface-muted text-muted'
                      }`}>
                        {trade.result}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs text-muted border-t border-border/50 pt-2.5">
                      <div>
                        <span className="text-muted font-normal">Date: </span>
                        <span className="text-foreground font-semibold">{new Date(trade.entryTime || trade.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-muted font-normal">P/L: </span>
                        <span className={`font-mono font-bold text-sm ${
                          trade.profitLossAmount > 0 ? 'text-emerald-400' : trade.profitLossAmount < 0 ? 'text-rose-400' : 'text-muted'
                        }`}>
                          {trade.profitLossAmount > 0 ? '+' : ''}${trade.profitLossAmount || 0}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-border/40">
                      <div className="flex gap-2 text-xs">
                        <Link to={`/trades/${trade.id}`} className="text-indigo-400 font-semibold hover:underline">
                          Details
                        </Link>
                        <span className="text-border">•</span>
                        <Link to={`/trades/${trade.id}/edit`} className="text-emerald-400 font-semibold hover:underline">
                          Edit
                        </Link>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setTradePendingDelete(trade)}
                        disabled={deletingTradeId === trade.id}
                        className="text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tablet & Desktop Full Interactive Table (≥640px) */}
              <div className="hidden sm:block bg-surface rounded-2xl border border-border overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-surface-muted/60 text-muted uppercase text-[11px] font-bold tracking-wider border-b border-border">
                      <tr>
                        <th className="px-6 py-3.5 font-bold">Pair / Dir</th>
                        <th className="px-6 py-3.5 font-bold">Date</th>
                        <th className="px-6 py-3.5 font-bold">Result</th>
                        <th className="px-6 py-3.5 font-bold">P/L ($)</th>
                        <th className="px-6 py-3.5 font-bold">Status</th>
                        <th className="px-6 py-3.5 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredTrades.map((trade) => (
                        <tr key={trade.id} className="hover:bg-surface-muted/40 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="font-bold text-foreground">{trade.pair}</div>
                            <div className={`text-xs font-bold ${trade.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {trade.direction}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-muted text-xs">
                            {new Date(trade.entryTime || trade.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              trade.result === 'WIN' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                              trade.result === 'LOSS' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 
                              'bg-surface-muted text-muted'
                            }`}>
                              {trade.result}
                            </span>
                          </td>
                          <td className={`px-6 py-4 font-mono font-bold text-sm ${
                            trade.profitLossAmount > 0 ? 'text-emerald-400' : trade.profitLossAmount < 0 ? 'text-rose-400' : 'text-muted'
                          }`}>
                            {trade.profitLossAmount > 0 ? '+' : ''}${trade.profitLossAmount || 0}
                          </td>
                          <td className="px-6 py-4 text-muted text-xs font-medium">{trade.status}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-3 text-xs">
                              <Link to={`/trades/${trade.id}`} className="text-indigo-400 hover:text-indigo-300 font-semibold">
                                Details
                              </Link>
                              <Link to={`/trades/${trade.id}/edit`} className="text-emerald-400 hover:text-emerald-300 font-semibold">
                                Edit
                              </Link>
                              <button
                                type="button"
                                onClick={() => setTradePendingDelete(trade)}
                                disabled={deletingTradeId === trade.id}
                                className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 disabled:opacity-50 font-semibold"
                              >
                                <Trash2 size={14} />
                                {deletingTradeId === trade.id ? 'Removing...' : 'Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <DeleteTradeDialog
        trade={tradePendingDelete}
        isOpen={Boolean(tradePendingDelete)}
        isDeleting={Boolean(deletingTradeId)}
        onCancel={() => setTradePendingDelete(null)}
        onConfirm={deleteTrade}
      />

      <ImportTradesModal
        defaultAccountId={searchParams.get('accountId')}
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImportSuccess={fetchTrades}
      />
    </div>
  );
};

export default TradesList;
