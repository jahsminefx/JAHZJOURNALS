import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Search, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

const TradesList = () => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrades();
  }, []);

  const fetchTrades = async () => {
    try {
      const { data } = await api.get('/trades');
      setTrades(data);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to load trades');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-gray-100 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-800 p-6 rounded-xl border border-gray-700 gap-4">
        <div>
          <h2 className="text-2xl font-bold">Trade Journal</h2>
          <p className="text-sm text-gray-400">Log and analyze your market executions</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
            <input type="text" placeholder="Search pairs, notes..." className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-sm focus:border-green-500 focus:outline-none" />
          </div>
          <button className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
            <Filter size={20} className="text-gray-300" />
          </button>
          <Link to="/trades/new" className="whitespace-nowrap flex items-center px-4 py-2 bg-green-500 text-gray-900 font-medium rounded-lg hover:bg-green-400 transition-colors">
            <PlusCircle size={20} className="mr-2 hidden sm:block" />
            Log Trade
          </Link>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-900/50 text-gray-400 uppercase text-xs">
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
                <tr><td colSpan="6" className="text-center py-8 text-gray-500">Loading trades...</td></tr>
              ) : trades.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-8 text-gray-500">No trades logged yet.</td></tr>
              ) : (
                trades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-100">{trade.pair}</div>
                      <div className={`text-xs ${trade.direction === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{trade.direction}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-400">{new Date(trade.entryTime || trade.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${trade.result === 'WIN' ? 'bg-green-500/20 text-green-400' : trade.result === 'LOSS' ? 'bg-red-500/20 text-red-400' : 'bg-gray-600 text-gray-300'}`}>
                        {trade.result}
                      </span>
                    </td>
                    <td className={`px-6 py-4 font-bold ${trade.profitLossAmount > 0 ? 'text-green-400' : trade.profitLossAmount < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {trade.profitLossAmount > 0 ? '+' : ''}{trade.profitLossAmount || 0}
                    </td>
                    <td className="px-6 py-4 text-gray-400 font-medium">{trade.status}</td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <Link to={`/trades/${trade.id}`} className="text-blue-400 hover:text-blue-300 font-medium tracking-wide">Details</Link>
                      <Link to={`/trades/${trade.id}/edit`} className="text-green-400 hover:text-green-300 font-medium tracking-wide">Edit</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TradesList;
