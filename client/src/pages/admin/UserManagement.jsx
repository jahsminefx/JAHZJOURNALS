import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Search, ShieldAlert, ShieldCheck, Mail, BrainCircuit, ScanLine, UserSquare2 } from 'lucide-react';
import { format } from 'date-fns';
import UserAiModal from '../../components/admin/UserAiModal';
import UserTimelineModal from './UserTimelineModal';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [isModifyingRole, setIsModifyingRole] = useState(null);
  const [selectedUserAi, setSelectedUserAi] = useState(null);
  const [selectedUserTimeline, setSelectedUserTimeline] = useState(null);

  const fetchUsers = async (search = '', pageNum = 1) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/admin/users?search=${encodeURIComponent(search)}&page=${pageNum}&limit=20`);
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      setPage(1);
      fetchUsers(searchTerm, 1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleRoleChange = async (userId, newRole) => {
    if (!window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;
    try {
      setIsModifyingRole(userId);
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      toast.success('User role updated successfully');
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update role');
    } finally {
      setIsModifyingRole(null);
    }
  };

  const executeImpersonation = async (targetUser) => {
      const reason = window.prompt(`[SECURITY LOCK] Provide a strict Audit Reason to formally impersonate ${targetUser.email}`);
      if (!reason) return;
      
      try {
          await api.post(`/admin/impersonate/${targetUser.id}`, { reason });
          window.location.href = '/dashboard';
      } catch (e) {
          toast.error(e.response?.data?.message || 'Impersonation boundary rejected natively.');
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage platform users, roles, and access.</p>
        </div>
        <div className="relative">
           <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
           <input 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             placeholder="Search by name or email..."
             className="pl-10 pr-4 py-2 bg-surface border border-border rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:border-emerald-500"
           />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-semibold">User</th>
                <th className="px-6 py-3 font-semibold">Role</th>
                <th className="px-6 py-3 font-semibold">Plan</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Joined</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                 <tr>
                   <td colSpan="6" className="px-6 py-8 text-center text-muted-foreground">Loading users...</td>
                 </tr>
              ) : users.length === 0 ? (
                 <tr>
                   <td colSpan="6" className="px-6 py-8 text-center text-muted-foreground">No users found.</td>
                 </tr>
              ) : users.map(user => (
                <tr key={user.id} className="hover:bg-surface-muted/50 transition">
                  <td className="px-6 py-4">
                    <div className="font-bold text-foreground">{user.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate" title={user.email}>{user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={user.role} 
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      disabled={isModifyingRole === user.id}
                      className={`text-xs px-2 py-1 rounded-md border font-bold ${
                         user.role === 'SUPER_ADMIN' ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                       : user.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                       : 'bg-surface text-foreground border-border'
                      }`}
                    >
                      <option value="TRADER">TRADER</option>
                      <option value="MENTOR">MENTOR</option>
                      <option value="MODERATOR">MODERATOR</option>
                      <option value="SUPPORT">SUPPORT</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold">
                    <span className={`px-2 py-1 rounded-full ${user.subscriptionPlan === 'FREE' ? 'bg-slate-500/10 text-slate-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {user.subscriptionPlan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                     {user.isDisabled ? (
                       <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                         <ShieldAlert size={14} /> Suspended
                       </span>
                     ) : (
                       <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                         <ShieldCheck size={14} /> Active
                       </span>
                     )}
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(user.createdAt), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                       <button onClick={() => executeImpersonation(user)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md transition" title="Assume User Identity (SUPER_ADMIN)">
                         <UserSquare2 size={16} />
                       </button>
                       <button onClick={() => setSelectedUserTimeline(user)} className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-md transition" title="Internal Support Timeline">
                         <ScanLine size={16} />
                       </button>
                       <button onClick={() => setSelectedUserAi(user)} className="p-1.5 text-purple-500 hover:bg-purple-500/10 rounded-md transition" title="AI Intelligence Tracer">
                         <BrainCircuit size={16} />
                       </button>
                       <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-muted rounded-md" title="Email User" onClick={() => window.location.href = `mailto:${user.email}`}>
                         <Mail size={16} />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */
        !loading && total > 20 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
             <span className="text-xs text-muted-foreground">Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} users</span>
             <div className="flex gap-2">
                <button 
                  disabled={page === 1} 
                  onClick={() => { setPage(p => p - 1); fetchUsers(searchTerm, page - 1); }}
                  className="px-3 py-1 rounded-md border border-border text-xs disabled:opacity-50 hover:bg-surface-muted"
                >
                  Previous
                </button>
                <button 
                  disabled={page * 20 >= total}
                  onClick={() => { setPage(p => p + 1); fetchUsers(searchTerm, page + 1); }}
                  className="px-3 py-1 rounded-md border border-border text-xs disabled:opacity-50 hover:bg-surface-muted"
                >
                  Next
                </button>
             </div>
          </div>
        )}
      </div>
      
      {selectedUserAi && (
        <UserAiModal user={selectedUserAi} onClose={() => setSelectedUserAi(null)} />
      )}
      {selectedUserTimeline && (
        <UserTimelineModal user={selectedUserTimeline} onClose={() => setSelectedUserTimeline(null)} />
      )}
    </div>
  );
};

export default UserManagement;
