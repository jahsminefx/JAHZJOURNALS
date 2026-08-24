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
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all"
        >
          <Plus size={16} /> Create Template
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-gray-400">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-800/40 border border-dashed border-gray-700 rounded-2xl">
          <FileText className="text-gray-500 mb-3" size={40} />
          <h3 className="text-sm font-bold text-gray-200">No Templates Available</h3>
          <p className="text-xs text-gray-400 max-w-sm mt-1 mb-4">
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
        <div className="grid md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-3 shadow-sm flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                    {t.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(t)}
                      className="p-1.5 text-gray-400 hover:text-amber-400 rounded-lg hover:bg-gray-800 transition"
                      title="Edit Template"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-400 rounded-lg hover:bg-gray-800 transition"
                      title="Delete Template"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-gray-100">{t.name}</h3>
                {t.subject && <p className="text-xs text-gray-400 font-medium">Subject: {t.subject}</p>}
                <p className="text-xs text-gray-300 bg-gray-950 p-3 rounded-xl border border-gray-800 font-mono whitespace-pre-wrap line-clamp-4">
                  {t.content}
                </p>
              </div>

              <div className="pt-2 text-[10px] text-gray-500 flex items-center justify-between border-t border-gray-800">
                <span>Variables: user.name, user.email</span>
                <span>Created {new Date(t.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Template Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-700 pb-3">
              <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                <FileText size={18} className="text-amber-400" /> {editingId ? 'Edit Template' : 'New Response Template'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g. Prop Firm Drawdown Explanation"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="SUPPORT">Customer Support Ticket Response</option>
                  <option value="ANNOUNCEMENT">Announcement Snippet</option>
                  <option value="EMAIL">Email Body Snippet</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-300 uppercase">Response Content</label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400">Insert tag:</span>
                    <button
                      type="button"
                      onClick={() => insertVariable('user.name')}
                      className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-amber-300 rounded text-[10px] font-bold"
                    >
                      + user.name
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('user.email')}
                      className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-amber-300 rounded text-[10px] font-bold"
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
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition"
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
