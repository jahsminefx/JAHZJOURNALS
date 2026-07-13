import React, { useCallback, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlusCircle, Search, Filter, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import DeleteTradeDialog from '../components/trades/DeleteTradeDialog';
import ImportTradesModal from '../components/trades/ImportTradesModal';

const TradesList = () => {
  const [searchParams] = useSearchParams();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingTradeId, setDeletingTradeId] = useState(null);
  const [tradePendingDelete, setTradePendingDelete] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const queryString = searchParams.toString();
  const pairFilter = searchParams.get('pair');
  const dateFilter = searchParams.get('date');

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

  return (
    <div className="space-y-6 text-foreground font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-surface-muted p-6 rounded-xl border border-border gap-4">
        <div>
          <h2 className="text-2xl font-bold">Your Trade Journal</h2>
          <p className="text-sm text-muted">
            {pairFilter || dateFilter
              ? `Filtered by ${pairFilter ? `pair ${pairFilter}` : ''}${pairFilter && dateFilter ? ' and ' : ''}${dateFilter ? `date ${dateFilter}` : ''}`
              : 'Your executions, your lessons, your growth'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {(pairFilter || dateFilter) && (
            <Link to="/trades" className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:border-green-500/60 hover:text-foreground">
              Clear Filter
            </Link>
          )}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" size={18} />
            <input type="text" placeholder="Search by pair, notes..." className="w-full bg-surface border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:border-green-500 focus:outline-none" />
          </div>
          <button className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
            <Filter size={20} className="text-muted" />
          </button>
          <button onClick={() => setShowImport(true)} className="whitespace-nowrap flex items-center px-3 py-2 bg-gray-700 text-foreground font-medium rounded-lg hover:bg-gray-600 transition-colors border border-gray-600 text-sm">
            Import CSV
          </button>
          <button onClick={() => window.open(`${api.defaults.baseURL}/trades/export-csv?${queryString}`, '_blank')} className="whitespace-nowrap flex items-center px-3 py-2 bg-gray-700 text-foreground font-medium rounded-lg hover:bg-gray-600 transition-colors border border-gray-600 text-sm">
            <Download size={16} className="mr-2" /> Export CSV
          </button>
          <Link to="/trades/new" className="whitespace-nowrap flex items-center px-4 py-2 bg-green-500 text-gray-900 font-medium rounded-lg hover:bg-green-400 transition-colors text-sm">
            <PlusCircle size={20} className="mr-2 hidden sm:block" />
            Log Trade
          </Link>
        </div>
      </div>

      <div className="bg-surface-muted rounded-xl border border-border overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-surface/50 text-muted uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium tracking-wider">Pair / Dir</th>
                <th className="px-6 py-4 font-medium tracking-wider">Date</th>
                <th className="px-6 py-4 font-medium tracking-wider">Result</th>
                <th className="px-6 py-4 font-medium tracking-wider">P/L ($)</th>
                <th className="px-6 py-4 font-medium tracking-wider">Status</th>
                <th className="px-6 py-4 font-medium tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                <tr><td colSpan="6" className="text-center py-8 text-muted">Gathering your trades...</td></tr>
              ) : trades.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-8 text-muted">No trades yet. Every journey starts with the first entry.</td></tr>
              ) : (
                trades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-foreground">{trade.pair}</div>
                      <div className={`text-xs ${trade.direction === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{trade.direction}</div>
                    </td>
                    <td className="px-6 py-4 text-muted">{new Date(trade.entryTime || trade.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${trade.result === 'WIN' ? 'bg-green-500/20 text-green-400' : trade.result === 'LOSS' ? 'bg-red-500/20 text-red-400' : 'bg-gray-600 text-muted'}`}>
                        {trade.result}
                      </span>
                    </td>
                    <td className={`px-6 py-4 font-bold ${trade.profitLossAmount > 0 ? 'text-green-400' : trade.profitLossAmount < 0 ? 'text-red-400' : 'text-muted'}`}>
                      {trade.profitLossAmount > 0 ? '+' : ''}{trade.profitLossAmount || 0}
                    </td>
                    <td className="px-6 py-4 text-muted font-medium">{trade.status}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                      <Link to={`/trades/${trade.id}`} className="text-blue-400 hover:text-blue-300 font-medium tracking-wide">Details</Link>
                      <Link to={`/trades/${trade.id}/edit`} className="text-green-400 hover:text-green-300 font-medium tracking-wide">Edit</Link>
                      <button
                        type="button"
                        onClick={() => setTradePendingDelete(trade)}
                        disabled={deletingTradeId === trade.id}
                        className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={`Delete ${trade.pair} trade`}
                      >
                        <Trash2 size={16} />
                        {deletingTradeId === trade.id ? 'Removing...' : 'Remove'}
                      </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
