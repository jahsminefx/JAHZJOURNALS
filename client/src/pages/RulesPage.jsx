import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusCircle, Trash2 } from 'lucide-react';
import api from '../utils/api';

const emptyForm = { name: '', description: '', active: true };

const RulesPage = () => {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState(null);

  const fetchRules = async () => {
    try {
      const { data } = await api.get('/rules');
      setRules(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Couldn\'t load your rules. Let\'s try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/rules/${editingId}`, form);
        toast.success('Rule updated.');
      } else {
        await api.post('/rules', form);
        toast.success('Your new rule is active.');
      }
      resetForm();
      await fetchRules();
    } catch (error) {
      toast.error(error.response?.data?.message || 'We couldn\'t save that rule right now.');
    } finally {
      setSaving(false);
    }
  };

  const editRule = (rule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      description: rule.description || '',
      active: rule.active,
    });
  };

  const toggleRule = async (rule) => {
    setActionId(rule.id);
    try {
      await api.patch(`/rules/${rule.id}/status`, { isActive: !rule.active });
      toast.success(rule.active ? 'Rule paused' : 'Rule enabled');
      await fetchRules();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Couldn\'t update that rule\'s status.');
    } finally {
      setActionId(null);
    }
  };

  const deleteRule = async (rule) => {
    if (!window.confirm(`Remove "${rule.name}"? If you've broken this rule before, just pause it instead so your old reviews still make sense.`)) return;

    setActionId(rule.id);
    try {
      await api.delete(`/rules/${rule.id}`);
      toast.success('Rule removed.');
      if (editingId === rule.id) resetForm();
      await fetchRules();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Couldn\'t remove that rule. Try again.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6 text-foreground font-sans">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-muted p-6">
        <h2 className="text-2xl font-bold">Your Trading Rules</h2>
        <p className="text-sm text-muted">Define the boundaries of your strategy. Pause them when they evolve.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.4fr] gap-6">
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface-muted p-6 space-y-4">
          <h3 className="text-lg font-bold text-green-400">{editingId ? 'Edit Rule' : 'New Rule'}</h3>
          <label className="block text-sm text-muted">
            Rule Name
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-3 text-foreground outline-none focus:border-green-400" />
          </label>
          <label className="block text-sm text-muted">
            Description
            <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows="5" className="mt-2 w-full resize-none rounded-lg border border-border bg-surface px-4 py-3 text-foreground outline-none focus:border-green-400" />
          </label>
          <label className="flex items-center gap-3 text-sm text-muted">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} className="h-4 w-4 rounded border-border bg-surface" />
            Active rule
          </label>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-green-400 disabled:opacity-70">
              <PlusCircle size={18} />
              {saving ? 'Saving...' : editingId ? 'Save Edits' : 'Create Rule'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-muted hover:bg-surface-muted">Cancel</button>
            )}
          </div>
        </form>

        <div className="rounded-xl border border-border bg-surface-muted overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted">Loading your boundaries...</div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center text-muted">Every disciplined trader has boundaries. Define your first rule to start.</div>
          ) : (
            <div className="divide-y divide-gray-700">
              {rules.map((rule) => (
                <div key={rule.id} className="p-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-bold text-foreground">{rule.name}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rule.active ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-muted'}`}>
                        {rule.active ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted">{rule.description || 'No description provided.'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => editRule(rule)} className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-foreground hover:bg-gray-600">Edit</button>
                    <button type="button" disabled={actionId === rule.id} onClick={() => toggleRule(rule)} className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-foreground hover:bg-gray-600 disabled:opacity-70">
                      {rule.active ? 'Pause' : 'Enable'}
                    </button>
                    <button type="button" disabled={actionId === rule.id} onClick={() => deleteRule(rule)} className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-70">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RulesPage;
