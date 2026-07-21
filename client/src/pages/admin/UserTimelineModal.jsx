import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { X, Activity, ShieldCheck, Ticket, StickyNote, Mail } from 'lucide-react';
import { format } from 'date-fns';

const UserTimelineModal = ({ user, onClose }) => {
    const [timeline, setTimeline] = useState(null);
    const [loading, setLoading] = useState(true);
    const [newNote, setNewNote] = useState('');

    useEffect(() => {
        if (!user) return;
        const fetchTimeline = async () => {
            try {
                const res = await api.get(`/admin/support/timeline?email=${user.email}`);
                setTimeline(res.data);
            } catch (e) {
                toast.error('Failed querying Timeline schemas');
            } finally {
                setLoading(false);
            }
        };
        fetchTimeline();
    }, [user]);

    const handleInjectNote = async () => {
        if (!newNote.trim()) return;
        try {
            const res = await api.post('/admin/support/notes', { userId: user.id, content: newNote });
            setTimeline(t => ({ ...t, internalNotes: [res.data, ...(t.internalNotes || [])] }));
            setNewNote('');
            toast.success('Internal Trace appended securely.');
        } catch (e) {
            toast.error('Append isolation failed');
        }
    };

    if (!user) return null;

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95">
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border bg-emerald-500/5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/20 text-emerald-500 rounded-xl">
                            <Activity size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-wide text-foreground">{user.name} / Operations Timeline</h2>
                            <p className="text-sm font-mono text-muted-foreground mt-1">{user.email}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-muted-foreground hover:bg-surface-muted rounded-full transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 text-emerald-500 animate-pulse font-bold tracking-widest uppercase text-sm">
                            Triaging Native Trace...
                        </div>
                    ) : !timeline ? (
                         <div className="text-center py-20 text-muted-foreground font-bold">Failed to resolve Entity.</div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Column 1: Tickets & Subscriptions */}
                            <div className="space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Ticket size={16}/> Support Trace</h3>
                                {timeline.supportTickets?.length === 0 ? (
                                    <div className="text-xs text-muted-foreground italic border border-dashed border-border p-4 rounded-xl">Zero explicit tickets on file.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {timeline.supportTickets?.map(t => (
                                            <div key={t.id} className="p-3 rounded-lg border border-border bg-surface-muted/30">
                                                <div className="flex justify-between items-start">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${t.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{t.status}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">{format(new Date(t.createdAt), 'dd MMM yyyy')}</span>
                                                </div>
                                                <p className="text-sm font-bold text-foreground mt-2">{t.subject}</p>
                                                {t.rating && <p className="text-xs text-yellow-500 mt-1">CSAT: {t.rating} ★</p>}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex justify-between items-center mt-8 border-t border-border pt-6"><ShieldCheck size={16} className="text-emerald-500"/> Native Subscriptions</h3>
                                <div className="space-y-2">
                                    {timeline.subscriptionHistories?.map(h => (
                                        <div key={h.id} className="flex justify-between items-center text-xs p-2 bg-surface rounded-lg border border-border">
                                            <span className="font-bold text-emerald-500">{h.newPlan}</span>
                                            <span className="text-muted-foreground font-mono">{format(new Date(h.createdAt), 'dd MMM')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Column 2: Internal Trace */}
                            <div className="space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                                    <StickyNote size={16}/> Internal Agent Notes (SuperAdmin Only)
                                </h3>

                                <div className="flex gap-2">
                                    <input 
                                       value={newNote} onChange={e => setNewNote(e.target.value)}
                                       className="flex-1 bg-surface-muted border border-border px-3 py-2 text-sm rounded-lg outline-none focus:border-emerald-500" 
                                       placeholder="Inject internal privacy note..." 
                                    />
                                    <button onClick={handleInjectNote} className="px-4 py-2 bg-emerald-500/10 text-emerald-500 font-bold text-xs uppercase tracking-wide rounded-lg hover:bg-emerald-500/20">Append</button>
                                </div>

                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                    {timeline.internalNotes?.length === 0 ? (
                                        <div className="text-xs text-muted-foreground italic text-center p-8">No persistent notes captured statically.</div>
                                    ) : timeline.internalNotes?.map(note => (
                                        <div key={note.id} className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 relative">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Agent Note</span>
                                                <span className="text-[10px] text-muted-foreground font-mono">{format(new Date(note.createdAt), 'dd MMM HH:mm')}</span>
                                            </div>
                                            <p className="text-sm font-semibold text-foreground/90 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserTimelineModal;
