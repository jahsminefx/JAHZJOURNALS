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
      toast.error(error.response?.data?.message || 'Failed to load rules');
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
        toast.success('Rule updated');
      } else {
        await api.post('/rules', form);
        toast.success('Rule created');
      }
      resetForm();
      await fetchRules();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save rule');
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
      toast.success(rule.active ? 'Rule disabled' : 'Rule enabled');
      await fetchRules();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update rule status');
    } finally {
      setActionId(null);
    }
  };

  const deleteRule = async (rule) => {
    if (!window.confirm(`Delete "${rule.name}"? Rules with historical violations should be disabled instead.`)) return;

    setActionId(rule.id);
    try {
      await api.delete(`/rules/${rule.id}`);
      toast.success('Rule deleted');
      if (editingId === rule.id) resetForm();
      await fetchRules();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete rule');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6 text-gray-100 font-sans">
      <div className="flex flex-col gap-2 rounded-xl border border-gray-700 bg-gray-800 p-6">
        <h2 className="text-2xl font-bold">Trading Rules</h2>
        <p className="text-sm text-gray-400">Create, edit, disable, or delete rules that are not referenced by historical violations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.4fr] gap-6">
        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-700 bg-gray-800 p-6 space-y-4">
          <h3 className="text-lg font-bold text-green-400">{editingId ? 'Edit Rule' : 'New Rule'}</h3>
          <label className="block text-sm text-gray-300">
            Rule Name
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-green-400" />
          </label>
          <label className="block text-sm text-gray-300">
            Description
            <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows="5" className="mt-2 w-full resize-none rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-green-400" />
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-300">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} className="h-4 w-4 rounded border-gray-700 bg-gray-900" />
            Active rule
          </label>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-green-400 disabled:opacity-70">
              <PlusCircle size={18} />
              {saving ? 'Saving...' : editingId ? 'Save Rule' : 'Create Rule'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">Cancel</button>
            )}
          </div>
        </form>

        <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading rules...</div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No trading rules yet. Create your first rule to start tracking discipline.</div>
          ) : (
            <div className="divide-y divide-gray-700">
              {rules.map((rule) => (
                <div key={rule.id} className="p-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-bold text-gray-100">{rule.name}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rule.active ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                        {rule.active ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-400">{rule.description || 'No description provided.'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => editRule(rule)} className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-gray-100 hover:bg-gray-600">Edit</button>
                    <button type="button" disabled={actionId === rule.id} onClick={() => toggleRule(rule)} className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-gray-100 hover:bg-gray-600 disabled:opacity-70">
                      {rule.active ? 'Disable' : 'Enable'}
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
