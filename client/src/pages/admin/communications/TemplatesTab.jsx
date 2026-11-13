import React, { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, Edit3, Tag, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../utils/api';

const TemplatesTab = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    name: '',
    category: 'SUPPORT',
    subject: '',
    content: ''
  });

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/communications/templates');
      setTemplates(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load message templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.content) {
      toast.error('Name and content are required');
      return;
    }

    try {
      if (editingId) {
        await api.put(`/admin/communications/templates/${editingId}`, form);
        toast.success('Template updated');
      } else {
        await api.post('/admin/communications/templates', form);
        toast.success('Template created');
      }
      setShowModal(false);
      setEditingId(null);
      setForm({ name: '', category: 'SUPPORT', subject: '', content: '' });
      fetchTemplates();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save template');
    }
  };

  const handleEdit = (tmpl) => {
    setEditingId(tmpl.id);
    setForm({
      name: tmpl.name,
      category: tmpl.category,
      subject: tmpl.subject || '',
      content: tmpl.content
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this template snippet?')) return;
    try {
      await api.delete(`/admin/communications/templates/${id}`);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete template');
    }
  };

  const insertVariable = (varName) => {
    setForm((prev) => ({
      ...prev,
      content: prev.content + ` {{${varName}}}`
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-700 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <FileText className="text-amber-400" size={22} /> Message & Reply Templates
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Create reusable support response snippets and variable tags for quick 1-click customer replies.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setForm({ name: '', category: 'SUPPORT', subject: '', content: '' });
            setShowModal(true);
          }}
          className="w-full sm:w-auto justify-center px-4 py-2.5 min-h-[40px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus size={16} /> Create Template
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-muted-foreground">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 sm:p-12 text-center bg-surface-muted/30 border border-dashed border-border rounded-2xl">
          <FileText className="text-muted-foreground mb-3" size={40} />
          <h3 className="text-sm font-bold text-foreground">No Templates Available</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
            Create reusable support response snippets with variable injection like {"{{user.name}}"} for instant team replies.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition"
          >
            Create First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-surface-muted/30 border border-border rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                    {t.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(t)}
                      className="p-1.5 text-muted-foreground hover:text-amber-500 rounded-lg hover:bg-surface transition"
                      title="Edit Template"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-1.5 text-muted-foreground hover:text-rose-500 rounded-lg hover:bg-surface transition"
                      title="Delete Template"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-foreground break-words">{t.name}</h3>
                {t.subject && <p className="text-xs text-muted-foreground font-medium break-words">Subject: {t.subject}</p>}
                <p className="text-xs text-foreground bg-background p-3 rounded-xl border border-border font-mono whitespace-pre-wrap line-clamp-4">
                  {t.content}
                </p>
              </div>

              <div className="pt-2 text-[10px] text-muted-foreground flex flex-wrap items-center justify-between gap-1 border-t border-border">
                <span>Variables: user.name, user.email</span>
                <span>Created {new Date(t.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Template Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-4 sm:p-5 bg-surface-muted/50 shrink-0">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <FileText size={18} className="text-amber-500" /> {editingId ? 'Edit Template' : 'New Response Template'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-foreground uppercase mb-1">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g. Prop Firm Drawdown Explanation"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-xs text-foreground focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground uppercase mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-xs text-foreground focus:border-amber-500 focus:outline-none"
                >
                  <option value="SUPPORT">Customer Support Ticket Response</option>
                  <option value="ANNOUNCEMENT">Announcement Snippet</option>
                  <option value="EMAIL">Email Body Snippet</option>
                </select>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-bold text-foreground uppercase">Response Content</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Insert tag:</span>
                    <button
                      type="button"
                      onClick={() => insertVariable('user.name')}
                      className="px-2 py-0.5 bg-surface-muted hover:bg-border text-amber-500 rounded text-[10px] font-bold border border-border"
                    >
                      + user.name
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('user.email')}
                      className="px-2 py-0.5 bg-surface-muted hover:bg-border text-amber-500 rounded text-[10px] font-bold border border-border"
                    >
                      + user.email
                    </button>
                  </div>
                </div>
                <textarea
                  rows={6}
                  placeholder="Hello {{user.name}},\n\nThank you for reaching out..."
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground font-mono focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-surface-muted hover:bg-border text-foreground rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-sm transition"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesTab;
