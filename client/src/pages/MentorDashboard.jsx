import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Users, UserPlus, FileText, Send, Wand2 } from 'lucide-react';
import api from '../utils/api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Button from '../components/Button';
import SectionHeader from '../components/SectionHeader';

const MentorDashboard = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [draftingFor, setDraftingFor] = useState(null);
  const [aiDrafts, setAiDrafts] = useState({});

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const { data } = await api.get('/mentors/groups');
      setGroups(data);
      if (data.length > 0) setActiveGroupId(data[0].id);
    } catch (err) {
      console.error(err);
      toast.error('Could not load mentor groups.');
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async () => {
    try {
      const { data } = await api.post('/mentors/groups', { name: 'Academy Cohort', description: 'New Trading Cohort' });
      setGroups([...groups, data]);
      setActiveGroupId(data.id);
      toast.success('Group created!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create group.');
    }
  };

  const inviteStudent = async (e) => {
    e.preventDefault();
    if (!activeGroupId || !newInviteEmail) return;
    try {
      await api.post(`/mentors/groups/${activeGroupId}/invite`, { email: newInviteEmail });
      toast.success('Student added successfully!');
      setNewInviteEmail('');
      fetchGroups();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add student.');
    }
  };

  const draftSummary = async (studentId) => {
    setDraftingFor(studentId);
    toast.loading('JAHZ AI is reviewing their past 20 trades...', { id: 'draftToast' });
    try {
      const { data } = await api.post(`/mentors/students/${studentId}/draft-summary`);
      setAiDrafts(prev => ({ ...prev, [studentId]: data }));
      toast.success('Draft prepared!', { id: 'draftToast' });
    } catch (error) {
      toast.error('Failed to generate draft.', { id: 'draftToast' });
    } finally {
      setDraftingFor(null);
    }
  };

  const publishSummary = async (studentId) => {
    if (!aiDrafts[studentId] || !aiDrafts[studentId].markdownLetter) return;
    try {
      await api.post(`/mentors/students/${studentId}/send-summary`, { markdownLetter: aiDrafts[studentId].markdownLetter });
      toast.success('Feedback securely saved to student\'s recent trade!');
      const updatedDrafts = { ...aiDrafts };
      delete updatedDrafts[studentId];
      setAiDrafts(updatedDrafts);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send feedback.');
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted">Loading Workspace...</div>;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-8">
        <SectionHeader title="Mentor Workspace" description="Manage your academy cohorts and review student journals." align="left" />
        
        <div className="flex justify-between items-center bg-surface border border-border p-4 rounded-xl">
          <p className="text-muted text-sm">You manage {groups.length} active groups.</p>
          <Button onClick={createGroup} className="bg-indigo-600 hover:bg-indigo-500 text-foreground">
            <Users size={16} className="mr-2" /> New Group
          </Button>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-xl">
            <h3 className="text-lg text-muted font-bold mb-2">No Groups Found</h3>
            <p className="text-sm text-muted mb-6">Create your first academy cohort to invite students.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1 border border-border rounded-xl bg-surface overflow-hidden h-fit">
              <div className="bg-surface-muted p-4 font-bold text-foreground">Your Cohorts</div>
              <ul className="divide-y divide-gray-800">
                {groups.map(g => (
                  <li 
                    key={g.id} 
                    onClick={() => setActiveGroupId(g.id)}
                    className={`p-4 cursor-pointer transition-colors ${activeGroupId === g.id ? 'bg-indigo-500/10 border-l-4 border-indigo-500' : 'hover:bg-surface-muted border-l-4 border-transparent'}`}
                  >
                    <div className="font-semibold">{g.name}</div>
                    <div className="text-xs text-muted">{g.students?.length || 0} Students</div>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="md:col-span-2 border border-border rounded-xl bg-surface p-6">
              {activeGroupId && (
                <>
                  <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400 mb-6 border-b border-border pb-4">
                    Students
                  </h3>
                  
                  <form onSubmit={inviteStudent} className="flex gap-3 mb-8">
                    <input 
                      type="email" 
                      placeholder="Student Email Address" 
                      value={newInviteEmail}
                      onChange={(e) => setNewInviteEmail(e.target.value)}
                      className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-sm text-foreground focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-600"
                    />
                    <Button type="submit" disabled={!newInviteEmail} className="bg-indigo-600 hover:bg-indigo-500">
                      <UserPlus size={16} className="mr-2" /> Assign Student
                    </Button>
                  </form>

                  <div className="space-y-3">
                    {groups.find(g => g.id === activeGroupId)?.students?.map(s => (
                      <div key={s.id} className="flex justify-between items-center p-3 border border-border bg-background rounded-lg">
                        <div>
                          <p className="font-medium text-foreground flex items-center gap-2">
                             {s.student?.name}
                             <span className={`text-xs px-2 py-1 rounded-full ${s.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-500'}`}>
                               {s.status}
                             </span>
                          </p>
                          <p className="text-xs text-muted mb-2">{s.student?.email}</p>
                          {aiDrafts[s.studentId] && (
                             <div className="mt-4 mb-2 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg max-w-lg">
                               <h4 className="text-sm font-bold text-purple-400 mb-2 flex items-center gap-2"><Wand2 size={14}/> {aiDrafts[s.studentId].draftTitle}</h4>
                               <textarea 
                                  className="w-full h-32 bg-background border border-border p-2 text-sm text-foreground rounded mt-1"
                                  value={aiDrafts[s.studentId].markdownLetter}
                                  onChange={(e) => setAiDrafts(prev => ({ ...prev, [s.studentId]: { ...prev[s.studentId], markdownLetter: e.target.value } }))}
                               ></textarea>
                               <Button className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-xs py-1" onClick={() => publishSummary(s.studentId)}>Send to Student Workspace</Button>
                             </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <button 
                            disabled={draftingFor === s.studentId}
                            onClick={() => draftSummary(s.studentId)}
                            className="text-xs px-3 py-1.5 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 flex items-center justify-center disabled:opacity-50"
                          >
                             {draftingFor === s.studentId ? 'Drafting...' : 'Autodraft AI Feedback'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default MentorDashboard;
