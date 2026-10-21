import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil, Save, X, ArrowUp, ArrowDown, CheckSquare, Sparkles } from 'lucide-react';
import api from '../../utils/api';

const inputClass = 'block w-full rounded-xl border border-border/80 bg-surface px-3.5 py-2 text-sm text-foreground outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20';

const ChecklistBuilder = ({ setup, onChecklistSaved }) => {
  const [items, setItems] = useState(
    setup.checklistItems ? [...setup.checklistItems].sort((a, b) => a.sortOrder - b.sortOrder) : []
  );
  const [saving, setSaving] = useState(false);

  const addNew = () => {
    setItems([...items, { title: '', required: true, category: 'General' }]);
  };

  const updateItem = (index, field, value) => {
    const next = [...items];
    next[index][field] = value;
    setItems(next);
  };

  const moveItem = (index, direction) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === items.length - 1) return;
    const next = [...items];
    const temp = next[index];
    next[index] = next[index + direction];
    next[index + direction] = temp;
    setItems(next);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = items.map((itm, idx) => ({ ...itm, sortOrder: idx }));
      const res = await api.put(`/setups/${setup.id}/checklist`, { items: payload });
      toast.success('Checklist updated.');
      onChecklistSaved(res.data);
    } catch (err) {
      toast.error('Failed to save checklist.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-border/70 bg-background/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
          <CheckSquare size={14} className="text-emerald-400"/> 
          Execution Checklist
        </h4>
        <span className="text-xs text-muted">
          {items.length} {items.length === 1 ? 'rule' : 'rules'}
        </span>
      </div>
      
      {items.length === 0 ? (
        <p className="mb-4 text-xs text-muted">No rules defined yet. Add a pre-flight checklist to prevent impulsive mistakes.</p>
      ) : (
        <div className="mb-4 space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl border border-border/80 bg-surface/90 p-2.5">
              <input
                className={`${inputClass} flex-1 !py-1.5`}
                value={item.title}
                placeholder="e.g. Price swept previous 4H high or liquidity pool"
                onChange={e => updateItem(idx, 'title', e.target.value)}
              />
              <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0">
                <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={item.required} 
                    onChange={e => updateItem(idx, 'required', e.target.checked)} 
                    className="rounded border-border text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Mandatory</span>
                </label>
                <div className="flex items-center gap-0.5 border-l border-border/70 pl-2">
                  <button 
                    type="button" 
                    onClick={() => moveItem(idx, -1)} 
                    disabled={idx === 0} 
                    className="p-1 rounded text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-20"
                    title="Move up"
                  >
                    <ArrowUp size={14}/>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => moveItem(idx, 1)} 
                    disabled={idx === items.length - 1} 
                    className="p-1 rounded text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-20"
                    title="Move down"
                  >
                    <ArrowDown size={14}/>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => removeItem(idx)} 
                    className="p-1 rounded text-muted hover:bg-red-500/10 hover:text-red-400"
                    title="Remove rule"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2.5 pt-1">
        <button 
          type="button" 
          onClick={addNew} 
          className="rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
        >
          + Add Rule
        </button>
        <button 
          type="button" 
          onClick={handleSave} 
          disabled={saving} 
          className="rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition disabled:opacity-70"
        >
          {saving ? 'Saving...' : 'Save Checklist'}
        </button>
      </div>
    </div>
  );
};

const SetupList = ({ strategyId, initialSetups, onSetupsChanged }) => {
  const [setups, setSetups] = useState(initialSetups || []);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({ name: '', description: '', preferredSession: '' });

  const handleSaveSetup = async (e, setupIdToEdit) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error('Setup name is required.');
    
    try {
      if (setupIdToEdit) {
        await api.put(`/setups/${setupIdToEdit}`, formData);
        toast.success('Setup updated.');
      } else {
        await api.post('/setups', { ...formData, strategyId });
        toast.success('Setup added.');
      }
      setIsAdding(false);
      setEditingId(null);
      setFormData({ name: '', description: '', preferredSession: '' });
      if (onSetupsChanged) onSetupsChanged();
    } catch (err) {
      toast.error('Error saving setup.');
    }
  };

  const startEdit = (setup) => {
    setEditingId(setup.id);
    setIsAdding(false);
    setFormData({ name: setup.name, description: setup.description || '', preferredSession: setup.preferredSession || '' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this setup?')) return;
    try {
      await api.delete(`/setups/${id}`);
      toast.success('Setup removed.');
      if (onSetupsChanged) onSetupsChanged();
    } catch {
      toast.error('Error deleting setup.');
    }
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-surface/90 p-5 sm:p-6 shadow-sm">
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Associated Setups</h3>
          <p className="text-xs text-muted mt-0.5">Define distinct model triggers or sessions under this strategy.</p>
        </div>
        {!isAdding && !editingId && (
          <button 
            type="button"
            onClick={() => setIsAdding(true)} 
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
          >
            <Plus size={14} /> Add Setup
          </button>
        )}
      </div>

      {(isAdding || editingId) && (
        <form onSubmit={(e) => handleSaveSetup(e, editingId)} className="mb-6 rounded-2xl border border-border bg-surface-muted/50 p-4 sm:p-5">
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Setup Name <span className="text-emerald-400">*</span>
              </label>
              <input 
                className={inputClass} 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="e.g. Turtle Soup, OTE Retracement"
                autoFocus 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Ideal Session
              </label>
              <select 
                className={inputClass} 
                value={formData.preferredSession} 
                onChange={e => setFormData({...formData, preferredSession: e.target.value})}
              >
                <option value="">Any Session</option>
                <option value="ASIAN">Asian Session</option>
                <option value="LONDON">London Session</option>
                <option value="NEW_YORK">New York Session</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">
                Description / Trigger Details
              </label>
              <input 
                className={inputClass} 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                placeholder="e.g. Occurs after 09:30 NY open, enters on FVG tap"
              />
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button 
              type="submit" 
              className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition"
            >
              {editingId ? 'Update Setup' : 'Save Setup'}
            </button>
            <button 
              type="button" 
              onClick={() => { setIsAdding(false); setEditingId(null); setFormData({name:'',description:'',preferredSession:''}); }} 
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {setups.map(setup => (
          <div key={setup.id} className="rounded-xl border border-border/80 bg-surface p-4 sm:p-5 transition hover:border-border">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-foreground">{setup.name}</h4>
                  {setup.preferredSession && (
                    <span className="rounded-md border border-border bg-surface-muted px-2 py-0.5 text-xs text-muted font-medium">
                      {setup.preferredSession}
                    </span>
                  )}
                </div>
                {setup.description && (
                  <p className="mt-1 text-xs text-muted leading-relaxed">{setup.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  type="button"
                  onClick={() => startEdit(setup)} 
                  className="rounded-lg border border-border bg-surface p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition"
                  title="Edit setup"
                >
                  <Pencil size={13}/>
                </button>
                <button 
                  type="button"
                  onClick={() => handleDelete(setup.id)} 
                  className="rounded-lg border border-border bg-surface p-1.5 text-muted hover:bg-red-500/10 hover:text-red-400 transition"
                  title="Delete setup"
                >
                  <Trash2 size={13}/>
                </button>
              </div>
            </div>
            
            <ChecklistBuilder 
              setup={setup} 
              onChecklistSaved={(newItems) => {
                if (onSetupsChanged) onSetupsChanged();
              }} 
            />
          </div>
        ))}
        {setups.length === 0 && !isAdding && (
          <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted">
            No setups mapped to this strategy yet. Add one above to build your execution checklists.
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupList;
