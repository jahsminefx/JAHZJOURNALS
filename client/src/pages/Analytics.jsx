import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import toast from 'react-hot-toast';
import api from '../utils/api';

const groupOptions = [
  'pair',
  'session',
  'setup',
  'strategy',
  'direction',
  'weekday',
  'timeframe',
  'emotion',
  'ruleViolation',
];

const emptyFilters = {
  accountId: '',
  startDate: '',
  endDate: '',
  pair: '',
  session: '',
  setup: '',
  strategy: '',
  direction: '',
  timeframe: '',
};

const Analytics = () => {
  const [accounts, setAccounts] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [groupBy, setGroupBy] = useState('pair');
  const [performance, setPerformance] = useState(null);
  const [equityCurve, setEquityCurve] = useState([]);
  const [drawdown, setDrawdown] = useState(null);
  const [loading, setLoading] = useState(true);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ groupBy });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return params;
  }, [filters, groupBy]);

  const filterQuery = useMemo(() => new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
  ), [filters]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [performanceResponse, equityResponse, drawdownResponse] = await Promise.all([
        api.get(`/analytics/performance?${queryParams.toString()}`),
        api.get(`/analytics/equity-curve?${filterQuery.toString()}`),
        api.get(`/analytics/drawdown?${filterQuery.toString()}`),
      ]);
      setPerformance(performanceResponse.data);
      setEquityCurve(equityResponse.data.data || []);
      setDrawdown(drawdownResponse.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'We had trouble pulling your analytics.');
    } finally {
      setLoading(false);
    }
  }, [filterQuery, queryParams]);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const { data } = await api.get('/accounts');
        setAccounts(data);
      } catch (error) {
        toast.error(error.response?.data?.message || 'We couldn\'t load your accounts.');
      }
    };
    loadAccounts();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setGroupBy('pair');
  };

  const summary = performance?.summary || {};
  const groupedData = performance?.data || [];
  const hasData = groupedData.length > 0;

  return (
    <div className="space-y-6 text-foreground font-sans">
      <div className="rounded-xl border border-border bg-surface-muted p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Analytics</h2>
            <p className="text-sm text-muted">Slice and dice your executions to find the edge hidden in the noise.</p>
          </div>
          <button type="button" onClick={clearFilters} className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-muted hover:bg-surface-muted">Clear Filters</button>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <label className="text-sm text-muted">
            Account
            <select value={filters.accountId} onChange={(event) => updateFilter('accountId', event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2">
              <option value="">All accounts</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-muted">
            Group By
            <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2">
              {groupOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-sm text-muted">
            Start Date
            <input type="date" value={filters.startDate} onChange={(event) => updateFilter('startDate', event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2" />
          </label>
          <label className="text-sm text-muted">
            End Date
            <input type="date" value={filters.endDate} onChange={(event) => updateFilter('endDate', event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2" />
          </label>
          <label className="text-sm text-muted">
            Pair
            <input value={filters.pair} onChange={(event) => updateFilter('pair', event.target.value)} placeholder="EURUSD" className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 uppercase" />
          </label>
          <label className="text-sm text-muted">
            Session
            <select value={filters.session} onChange={(event) => updateFilter('session', event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2">
              <option value="">Any</option>
              <option value="ASIAN">Asian</option>
              <option value="LONDON">London</option>
              <option value="NEW_YORK">New York</option>
              <option value="LONDON_NEW_YORK_OVERLAP">London/NY Overlap</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="text-sm text-muted">
            Setup
            <input value={filters.setup} onChange={(event) => updateFilter('setup', event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2" />
          </label>
          <label className="text-sm text-muted">
            Strategy
            <input value={filters.strategy} onChange={(event) => updateFilter('strategy', event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2" />
          </label>
          <label className="text-sm text-muted">
            Direction
            <select value={filters.direction} onChange={(event) => updateFilter('direction', event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2">
              <option value="">Any</option>
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
            </select>
          </label>
          <label className="text-sm text-muted">
            Timeframe
            <input value={filters.timeframe} onChange={(event) => updateFilter('timeframe', event.target.value)} placeholder="15M" className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2" />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-surface-muted p-8 text-center text-muted">Gathering your insights...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {[
              ['Net Realised P/L', `$${Number(summary.netRealisedProfitLoss || 0).toFixed(2)}`],
              ['Win Rate', `${Number(summary.winRate || 0).toFixed(1)}%`],
              ['Profit Factor', summary.profitFactor === null ? 'N/A' : Number(summary.profitFactor || 0).toFixed(2)],
              ['Expectancy', `$${Number(summary.expectancy || 0).toFixed(2)}`],
              ['Avg Win / Loss', `$${Number(summary.averageWin || 0).toFixed(2)} / $${Number(summary.averageLoss || 0).toFixed(2)}`],
              ['Avg R:R', summary.averageRiskRewardRatio === null ? 'N/A' : `1 : ${Number(summary.averageRiskRewardRatio || 0).toFixed(2)}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-surface-muted p-5">
                <p className="text-sm text-muted">{label}</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface-muted p-6">
              <h3 className="mb-5 text-lg font-bold">Grouped Performance</h3>
              {!hasData ? (
                <div className="flex h-72 items-center justify-center text-muted">The charts are quiet. Try different filters.</div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupedData.slice(0, 12)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="label" stroke="#9ca3af" axisLine={false} tickLine={false} />
                      <YAxis stroke="#9ca3af" axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.5rem' }} />
                      <Bar dataKey="netRealisedProfitLoss" fill="#4ade80" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface-muted p-6">
              <h3 className="mb-5 text-lg font-bold">Equity Curve</h3>
              {equityCurve.length === 0 ? (
                <div className="flex h-72 items-center justify-center text-muted">No closed trades yet. Your equity curve will build over time.</div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={equityCurve}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="label" stroke="#9ca3af" axisLine={false} tickLine={false} hide />
                      <YAxis stroke="#9ca3af" axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.5rem' }} />
                      <Line type="monotone" dataKey="equity" stroke="#4ade80" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface-muted overflow-hidden">
            <div className="border-b border-border px-6 py-4">
              <h3 className="font-bold">Performance Table</h3>
              <p className="text-sm text-muted">Maximum drawdown: ${Number(drawdown?.maximumDrawdown || 0).toFixed(2)}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface/60 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-5 py-3">Group</th>
                    <th className="px-5 py-3">Trades</th>
                    <th className="px-5 py-3">Win Rate</th>
                    <th className="px-5 py-3">Net P/L</th>
                    <th className="px-5 py-3">Profit Factor</th>
                    <th className="px-5 py-3">Expectancy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {groupedData.length === 0 ? (
                    <tr><td colSpan="6" className="px-5 py-8 text-center text-muted">No records to display right now.</td></tr>
                  ) : groupedData.map((row) => (
                    <tr key={row.key}>
                      <td className="px-5 py-3 font-medium text-foreground">{row.label}</td>
                      <td className="px-5 py-3 text-muted">{row.associatedTradeCount ?? row.totalTrades}</td>
                      <td className="px-5 py-3 text-muted">{Number(row.winRate || 0).toFixed(1)}%</td>
                      <td className={`px-5 py-3 font-semibold ${row.netRealisedProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>${Number(row.netRealisedProfitLoss || 0).toFixed(2)}</td>
                      <td className="px-5 py-3 text-muted">{row.profitFactor === null ? 'N/A' : Number(row.profitFactor || 0).toFixed(2)}</td>
                      <td className="px-5 py-3 text-muted">${Number(row.expectancy || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;
