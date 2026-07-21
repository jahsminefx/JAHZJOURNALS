import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Trash } from 'lucide-react';
import api from '../../utils/api';
import SetupList from './SetupList';

const inputClass = 'mt-2 block w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:border-green-400 disabled:cursor-not-allowed disabled:opacity-60';

const Field = ({ label, description, children }) => (
  <label className="block text-sm text-muted">
    <span className="font-medium text-foreground">{label}</span>
    {description && <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>}
    {children}
  </label>
);

const TextInput = ({ label, description, ...props }) => (
  <Field label={label} description={description}>
    <input {...props} className={inputClass} />
  </Field>
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
    e.preventDefault();
    if (!formData.name) return toast.error('Strategy name is required.');
    
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
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-foreground">
            {strategy ? 'Edit Strategy' : 'New Strategy'}
          </h2>
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-gray-900 transition hover:bg-green-400 disabled:opacity-70"
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Strategy'}
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface-muted p-5 sm:p-6">
        <h3 className="mb-4 text-base font-bold text-foreground">System Details</h3>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <TextInput 
              label="Strategy Name" 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })} 
              required
              placeholder="e.g. Silver Bullet, ICT London..."
            />
          </div>
          <div className="md:col-span-2">
            <Field label="Description" description="A short summary of what this strategy is designed to capture.">
              <textarea 
                className={inputClass + ' resize-y'} 
                rows={3}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </Field>
          </div>
          <TextInput 
            label="Style" 
            value={formData.style} 
            onChange={e => setFormData({ ...formData, style: e.target.value })} 
            placeholder="e.g. Day Trading, Scalping"
          />
          <TextInput 
            label="Primary Market" 
            value={formData.market} 
            onChange={e => setFormData({ ...formData, market: e.target.value })} 
            placeholder="e.g. Forex, Crypto, Indices"
          />
          <TextInput 
            type="number" 
            step="0.1" 
            label="Default Risk (%)" 
            value={formData.defaultRiskPercent} 
            onChange={e => setFormData({ ...formData, defaultRiskPercent: e.target.value })} 
            placeholder="e.g. 1.0"
          />
        </div>
      </div>

      {currentStrategy?.id && (
        <div className="mt-8">
          <SetupList strategyId={currentStrategy.id} initialSetups={currentStrategy.setups} onSetupsChanged={refreshStrategy} />
        </div>
      )}
    </div>
  );
};

export default StrategyForm;
