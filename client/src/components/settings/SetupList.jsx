import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil, Save, X, ArrowUp, ArrowDown, CheckSquare } from 'lucide-react';
import api from '../../utils/api';

const inputClass = 'block w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition focus:border-green-400';

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
    <div className="mt-4 rounded-xl border border-border bg-background p-4">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-bold text-foreground"><CheckSquare size={16} className="text-green-400"/> Execution Checklist</h4>
      </div>
      
      {items.length === 0 ? (
        <p className="mb-4 text-sm text-muted">No rules defined. Add a checklist to prevent impulsive mistakes before entering.</p>
      ) : (
        <div className="mb-4 space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-lg border border-border bg-surface p-2 sm:grid">
              <input
                className={`${inputClass} !py-1`}
                value={item.title}
                placeholder="e.g. Price tapped 15m order block"
                onChange={e => updateItem(idx, 'title', e.target.value)}
              />
              <label className="flex items-center gap-2 text-xs text-muted">
                <input 
                  type="checkbox" 
                  checked={item.required} 
                  onChange={e => updateItem(idx, 'required', e.target.checked)} 
                  className="rounded border-border text-green-500"
                />
                Required
              </label>
              <div className="flex items-center">
                <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="p-1 text-muted hover:text-foreground disabled:opacity-30"><ArrowUp size={14}/></button>
                <button onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} className="p-1 text-muted hover:text-foreground disabled:opacity-30"><ArrowDown size={14}/></button>
              </div>
              <button onClick={() => removeItem(idx)} className="p-1 text-red-500/70 hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={addNew} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface-muted">
          Add Rule
        </button>
        <button onClick={handleSave} disabled={saving} className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-bold text-gray-900 hover:bg-green-400 disabled:opacity-70">
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
    if (!formData.name) return toast.error('Setup name is required.');
    
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
    <div className="rounded-xl border border-border bg-surface-muted p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">Associated Setups</h3>
          <p className="text-xs text-muted">A strategy can have multiple distinct conditions or temporal setups.</p>
        </div>
        {!isAdding && !editingId && (
          <button onClick={() => setIsAdding(true)} className="flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface-muted">
            <Plus size={14} /> Add Setup
          </button>
        )}
      </div>

      {(isAdding || editingId) && (
        <form onSubmit={(e) => handleSaveSetup(e, editingId)} className="mb-6 rounded-xl border border-border bg-surface p-4">
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <label className="block text-xs text-muted">
              Name
              <input className={`${inputClass} mt-1`} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoFocus />
            </label>
            <label className="block text-xs text-muted">
              Ideal Session
              <select className={`${inputClass} mt-1`} value={formData.preferredSession} onChange={e => setFormData({...formData, preferredSession: e.target.value})}>
                <option value="">Any</option>
                <option value="ASIAN">Asian</option>
                <option value="LONDON">London</option>
                <option value="NEW_YORK">New York</option>
              </select>
            </label>
            <label className="block text-xs text-muted md:col-span-2">
              Description / Notes
              <input className={`${inputClass} mt-1`} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </label>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="rounded-lg bg-green-500 px-4 py-2 text-xs font-bold text-gray-900 transition hover:bg-green-400">Save Setup Configuration</button>
            <button type="button" onClick={() => { setIsAdding(false); setEditingId(null); setFormData({name:'',description:'',preferredSession:''}); }} className="rounded-lg border border-border px-4 py-2 text-xs font-bold text-foreground transition hover:bg-surface-muted">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {setups.map(setup => (
          <div key={setup.id} className="rounded-xl border border-border bg-surface p-4 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-bold text-foreground">{setup.name}</h4>
                <p className="mt-1 text-xs text-muted">{setup.description} {setup.preferredSession ? `• Session: ${setup.preferredSession}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(setup)} className="rounded-lg bg-surface-muted p-1.5 text-muted hover:text-foreground"><Pencil size={14}/></button>
                <button onClick={() => handleDelete(setup.id)} className="rounded-lg bg-surface-muted p-1.5 text-muted hover:text-red-400"><Trash2 size={14}/></button>
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
          <p className="text-sm text-muted">No setups mapped yet.</p>
        )}
      </div>
    </div>
  );
};

export default SetupList;
