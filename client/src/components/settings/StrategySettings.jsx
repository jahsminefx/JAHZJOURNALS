import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Layers, Plus, Pencil, Trash2 } from 'lucide-react';
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
    <section className="rounded-xl border border-border bg-surface-muted p-5 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Trading Strategies</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Map out your edge by building structured strategies, setups, and execution checklists.</p>
        </div>
        <button
          onClick={handleAddNew}
          className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-gray-900 transition hover:bg-green-400"
        >
          <Plus size={16} />
          New Strategy
        </button>
      </div>

      <div className="pt-5 space-y-4">
        {loading ? (
          <p className="text-sm text-muted">Loading strategies...</p>
        ) : strategies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
            <Layers className="mx-auto mb-3 h-8 w-8 text-foreground/30" />
            <p>You haven't defined any master trading strategies yet.</p>
          </div>
        ) : (
          strategies.map((strat) => (
            <div key={strat.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 transition hover:border-foreground/20">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{strat.name}</span>
                  {strat.isImported && (
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-bold text-blue-400">Imported</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {strat.setups.length} setups • {strat.style || 'No style'} • {strat.market || 'Any market'}
                </p>
                {strat.description && <p className="mt-2 text-sm text-muted line-clamp-1">{strat.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(strat)}
                  className="rounded-lg border border-border p-2 text-muted hover:bg-surface-muted hover:text-foreground"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(strat.id, strat.name)}
                  className="rounded-lg border border-border p-2 text-red-500/70 hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default StrategySettings;
