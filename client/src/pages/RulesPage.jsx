import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PlusCircle, Trash2, Edit3, PauseCircle, PlayCircle, ShieldCheck, CheckCircle2 } from 'lucide-react';
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
    if (!form.name.trim()) {
      return toast.error('Rule name is required.');
    }

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/rules/${editingId}`, form);
        toast.success('Rule updated successfully.');
      } else {
        await api.post('/rules', form);
        toast.success('Your new trading rule is active.');
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
    if (!window.confirm(`Remove "${rule.name}"? If you've logged trades against this rule, pause it instead so your historical reviews remain intact.`)) return;

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
    <div className="space-y-8 text-foreground font-sans">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Trading Rules</h1>
          <p className="text-xs sm:text-sm text-muted mt-1">Define your execution boundaries and discipline guidelines. Pause rules as your edge evolves.</p>
        </div>
      </div>

      {/* 2. Main Two-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-5 rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-sm space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h2 className="text-base font-bold text-foreground">
              {editingId ? 'Edit Rule' : 'Create a Trading Rule'}
            </h2>
            <p className="text-xs text-muted mt-0.5">
              {editingId ? 'Modify this boundary or its description.' : 'Establish a discipline rule to protect your risk and psychology.'}
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rule-name" className="block text-xs font-bold uppercase tracking-wider text-muted">
              Rule Name <span className="text-emerald-500">*</span>
            </label>
            <input
              id="rule-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Max 2 trades per session"
              required
              className="w-full rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-xs text-foreground placeholder:text-muted outline-none transition focus:border-emerald-500 focus:bg-surface shadow-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rule-description" className="block text-xs font-bold uppercase tracking-wider text-muted">
              Description <span className="text-muted font-normal text-[11px]">(Optional)</span>
            </label>
            <textarea
              id="rule-description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              placeholder="Why does this rule exist? What triggers a violation?"
              className="w-full resize-y rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-xs text-foreground placeholder:text-muted outline-none transition focus:border-emerald-500 focus:bg-surface shadow-sm"
            />
          </div>

          {/* Active status toggle */}
          <div className="pt-1">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                className="h-4 w-4 rounded border-border bg-surface-muted text-emerald-500 focus:ring-emerald-500/20"
              />
              <span className="text-xs font-semibold text-foreground">Active Rule</span>
              <span className="text-[11px] text-muted">({form.active ? 'Monitored in trade logs' : 'Currently paused'})</span>
            </label>
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-border/60 flex items-center gap-2.5">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60 shadow-sm shadow-emerald-500/10"
            >
              <PlusCircle size={15} />
              <span>{saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Rule'}</span>
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-xs font-semibold text-muted hover:text-foreground transition"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Right Column: Rules List */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-foreground">Configured Rules</h2>
              <span className="inline-flex items-center justify-center rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-muted border border-border">
                {rules.length}
              </span>
            </div>
            <span className="text-xs text-muted">
              {rules.filter((r) => r.active).length} active
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-muted font-medium animate-pulse">
              Loading your rules...
            </div>
          ) : rules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-surface-muted text-muted mb-3 border border-border">
                <ShieldCheck size={22} />
              </div>
              <h3 className="text-sm font-bold text-foreground">No trading rules configured</h3>
              <p className="mt-1 text-xs text-muted max-w-sm mx-auto">
                Discipline begins with clear boundaries. Use the form on the left to define your first trading rule.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border border-border bg-surface transition-all duration-200 hover:border-border-strong hover:shadow-sm"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-sm font-bold text-foreground break-words">{rule.name}</h3>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        rule.active
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-surface-muted text-muted border border-border'
                      }`}>
                        {rule.active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    {rule.description ? (
                      <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2">{rule.description}</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-muted/60 italic">No description provided</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                    <button
                      type="button"
                      onClick={() => editRule(rule)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted/80 transition"
                      title="Edit rule"
                    >
                      <Edit3 size={13} />
                      <span className="hidden sm:inline">Edit</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionId === rule.id}
                      onClick={() => toggleRule(rule)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                        rule.active
                          ? 'border-border bg-surface-muted text-muted hover:text-foreground'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                      }`}
                      title={rule.active ? 'Pause rule' : 'Enable rule'}
                    >
                      {rule.active ? <PauseCircle size={13} /> : <PlayCircle size={13} />}
                      <span>{rule.active ? 'Pause' : 'Enable'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionId === rule.id}
                      onClick={() => deleteRule(rule)}
                      className="inline-flex items-center rounded-lg border border-border bg-surface-muted p-1.5 text-xs text-muted hover:text-rose-400 hover:border-rose-500/30 transition disabled:opacity-60"
                      title="Delete rule"
                    >
                      <Trash2 size={13} />
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
