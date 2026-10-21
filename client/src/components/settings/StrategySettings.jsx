import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Layers, Plus, Pencil, Trash2, ArrowRight } from 'lucide-react';
import api from '../../utils/api';
import StrategyForm from './StrategyForm';

const StrategySettings = () => {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStrategy, setActiveStrategy] = useState(null);
  const [view, setView] = useState('LIST'); // 'LIST' or 'FORM'

  const fetchStrategies = async () => {
    try {
      setLoading(true);
      const res = await api.get('/strategies');
      setStrategies(res.data);
    } catch (err) {
      toast.error('Failed to load strategies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategies();
  }, []);

  const handleAddNew = () => {
    setActiveStrategy(null);
    setView('FORM');
  };

  const handleEdit = (strat) => {
    setActiveStrategy(strat);
    setView('FORM');
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}? This will archive it.`)) return;
    try {
      await api.delete(`/strategies/${id}`);
      toast.success('Strategy archived.');
      fetchStrategies();
    } catch (error) {
      toast.error('Error deleting strategy.');
    }
  };

  if (view === 'FORM') {
    return (
      <StrategyForm 
        strategy={activeStrategy}
        onBack={() => setView('LIST')}
        onSaved={() => {
          fetchStrategies();
          setView('LIST');
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Trading Strategies</h1>
          <p className="mt-1 text-sm text-muted">
            Define structured trading playbooks, setups, and pre-execution checklists to protect your edge.
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 active:translate-y-0.5"
        >
          <Plus size={16} />
          <span>New Strategy</span>
        </button>
      </div>

      {/* Strategies List */}
      <div className="space-y-4">
        {loading ? (
          <div className="grid gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-border/70 bg-surface/80 p-6">
                <div className="h-5 w-48 rounded bg-border/40 mb-3" />
                <div className="h-4 w-72 rounded bg-border/30 mb-4" />
                <div className="h-4 w-28 rounded bg-border/20" />
              </div>
            ))}
          </div>
        ) : strategies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center sm:p-12">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-muted mb-4 border border-border/80">
              <Layers className="h-6 w-6 text-muted" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No strategies defined yet</h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
              Map out your playbook with entry criteria, market sessions, and execution checklists to ensure disciplined trade execution.
            </p>
            <div className="mt-6">
              <button
                onClick={handleAddNew}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 transition"
              >
                <Plus size={16} />
                Create First Strategy
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {strategies.map((strat) => (
              <div 
                key={strat.id} 
                className="group rounded-2xl border border-border/80 bg-surface/90 p-5 sm:p-6 transition-all duration-200 hover:border-border hover:shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-lg font-semibold tracking-tight text-foreground">
                        {strat.name}
                      </h3>
                      {strat.isImported && (
                        <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-400">
                          Imported
                        </span>
                      )}
                      {strat.style && (
                        <span className="rounded-md border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-foreground/80">
                          {strat.style}
                        </span>
                      )}
                      {strat.market && (
                        <span className="rounded-md border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-muted">
                          {strat.market}
                        </span>
                      )}
                      {strat.defaultRiskPercent && (
                        <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                          {strat.defaultRiskPercent}% Risk
                        </span>
                      )}
                    </div>

                    {strat.description ? (
                      <p className="text-sm text-muted line-clamp-2 leading-relaxed">
                        {strat.description}
                      </p>
                    ) : (
                      <p className="text-xs italic text-muted/70">No description provided.</p>
                    )}

                    <div className="pt-1 flex items-center gap-4 text-xs text-muted">
                      <span className="inline-flex items-center gap-1.5 font-medium text-foreground/75">
                        <Layers size={13} className="text-emerald-400" />
                        {strat.setups?.length || 0} {strat.setups?.length === 1 ? 'setup' : 'setups'} configured
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-start">
                    <button
                      onClick={() => handleEdit(strat)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-muted"
                      title="Edit strategy"
                    >
                      <Pencil size={13} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(strat.id, strat.name)}
                      className="rounded-lg border border-border bg-surface p-1.5 text-muted transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                      title="Archive strategy"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategySettings;
