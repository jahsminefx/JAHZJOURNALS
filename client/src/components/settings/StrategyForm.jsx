import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';
import api from '../../utils/api';
import SetupList from './SetupList';

const inputClass = 'mt-1.5 block w-full rounded-xl border border-border/80 bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60';

const Field = ({ label, description, required, children }) => (
  <label className="block text-sm">
    <div className="flex items-center gap-1 font-medium text-foreground">
      <span>{label}</span>
      {required && <span className="text-emerald-400">*</span>}
    </div>
    {description && <p className="mt-0.5 text-xs text-muted leading-relaxed">{description}</p>}
    {children}
  </label>
);

const StrategyForm = ({ strategy, onBack, onSaved }) => {
  const [formData, setFormData] = useState({
    name: strategy?.name || '',
    description: strategy?.description || '',
    style: strategy?.style || '',
    market: strategy?.market || '',
    defaultRiskPercent: strategy?.defaultRiskPercent || '',
  });

  const [currentStrategy, setCurrentStrategy] = useState(strategy);
  const [saving, setSaving] = useState(false);

  const refreshStrategy = async () => {
    if (!strategy?.id) return;
    try {
      const res = await api.get(`/strategies/${strategy.id}`);
      setCurrentStrategy(res.data);
    } catch {
      // silent — data will refresh on next navigation
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) return toast.error('Strategy name is required.');
    
    setSaving(true);
    try {
      if (strategy?.id) {
        await api.put(`/strategies/${strategy.id}`, formData);
        toast.success('Strategy updated.');
      } else {
        await api.post('/strategies', formData);
        toast.success('Strategy created.');
      }
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error saving strategy.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={onBack} 
            className="rounded-xl border border-border/80 bg-surface/80 p-2 text-muted transition hover:bg-surface-muted hover:text-foreground"
            title="Back to strategies"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {strategy ? `Edit: ${strategy.name}` : 'New Trading Strategy'}
            </h1>
            <p className="text-xs text-muted mt-0.5">
              {strategy ? 'Refine playbook parameters, associated setups, and execution rules.' : 'Build a repeatable trading edge with structured entry criteria.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
          >
            <Save size={15} />
            {saving ? 'Saving...' : 'Save Strategy'}
          </button>
        </div>
      </div>

      {/* Main Details Form */}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-border/80 bg-surface/90 p-5 sm:p-6 space-y-6 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-foreground">Strategy Overview</h2>
          <p className="text-xs text-muted mt-0.5">Core identification and premise for this playbook.</p>
        </div>

        <div className="grid gap-5">
          <Field label="Strategy Name" required>
            <input 
              type="text"
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })} 
              required
              placeholder="e.g. Silver Bullet, ICT London Open, Trend Continuation..."
              className={inputClass}
            />
          </Field>

          <Field 
            label="Description & Philosophy" 
            description="A concise summary of market conditions and the core edge this strategy exploits."
          >
            <textarea 
              rows={3}
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g. Focuses on liquidity sweeps during the London killzone followed by a MSS on the 5m timeframe..."
              className={inputClass + ' resize-y leading-relaxed'}
            />
          </Field>
        </div>

        <div className="border-t border-border/70 pt-5">
          <h2 className="text-base font-semibold text-foreground mb-1">Execution Parameters</h2>
          <p className="text-xs text-muted mb-4">Default trading parameters applied when logging trades with this strategy.</p>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Trading Style">
              <input 
                type="text"
                value={formData.style} 
                onChange={e => setFormData({ ...formData, style: e.target.value })} 
                placeholder="e.g. Scalping, Day Trading, Swing"
                className={inputClass}
              />
            </Field>

            <Field label="Primary Market">
              <input 
                type="text"
                value={formData.market} 
                onChange={e => setFormData({ ...formData, market: e.target.value })} 
                placeholder="e.g. Forex Majors, Indices, Gold"
                className={inputClass}
              />
            </Field>

            <Field label="Default Risk (%)">
              <input 
                type="number" 
                step="0.1" 
                min="0"
                max="100"
                value={formData.defaultRiskPercent} 
                onChange={e => setFormData({ ...formData, defaultRiskPercent: e.target.value })} 
                placeholder="e.g. 1.0"
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        {/* Bottom Form Actions */}
        <div className="border-t border-border/70 pt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
          >
            <Save size={15} />
            {saving ? 'Saving...' : 'Save Strategy'}
          </button>
        </div>
      </form>

      {/* Setups & Checklists Section */}
      {currentStrategy?.id && (
        <div className="mt-8">
          <SetupList 
            strategyId={currentStrategy.id} 
            initialSetups={currentStrategy.setups} 
            onSetupsChanged={refreshStrategy} 
          />
        </div>
      )}
    </div>
  );
};

export default StrategyForm;
