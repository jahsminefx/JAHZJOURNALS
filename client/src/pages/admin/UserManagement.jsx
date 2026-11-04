import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Search, ShieldAlert, ShieldCheck, Mail, BrainCircuit, ScanLine, UserSquare2, RefreshCw, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import UserAiModal from '../../components/admin/UserAiModal';
import UserTimelineModal from './UserTimelineModal';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isModifyingRole, setIsModifyingRole] = useState(null);
  const [isModifyingPlan, setIsModifyingPlan] = useState(null);
  const [selectedUserAi, setSelectedUserAi] = useState(null);
  const [selectedUserTimeline, setSelectedUserTimeline] = useState(null);

  const fetchUsers = async (search = '', pageNum = 1, plan = planFilter, role = roleFilter) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search,
        page: pageNum,
        limit: 20,
      });
      if (plan) params.set('plan', plan);
      if (role) params.set('role', role);
      const { data } = await api.get(`/admin/users?${params.toString()}`);
      setUsers(Array.isArray(data?.users) ? data.users : []);
      setTotal(data?.total || 0);
    } catch (err) {
      toast.error('Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search and filter updates
    const timer = setTimeout(() => {
      setPage(1);
      fetchUsers(searchTerm, 1, planFilter, roleFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, planFilter, roleFilter]);

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

  const handlePlanChange = async (user, selectedValue) => {
    let newPlan = selectedValue;
    let newMentorTier = null;
    let label = selectedValue;

    if (selectedValue.startsWith('MENTOR_')) {
      newPlan = 'MENTOR';
      if (selectedValue === 'MENTOR_MEGA') {
        newMentorTier = 'MEGA';
        label = 'Mega Academy (Up to 1,000 Students)';
      } else if (selectedValue === 'MENTOR_GROWTH') {
        newMentorTier = 'GROWTH';
        label = 'Growth Community (Up to 200 Students)';
      } else {
        newMentorTier = 'PRIVATE_COHORT';
        label = 'Private Cohort (Up to 80 Students)';
      }
    }

    const currentKey = (user.subscriptionPlan === 'MENTOR' || user.role === 'MENTOR')
      ? (user.mentorTier === 'MEGA' || user.mentorTier === 'MEGA_ACADEMY' ? 'MENTOR_MEGA' : user.mentorTier === 'GROWTH' || user.mentorTier === 'GROWTH_COMMUNITY' ? 'MENTOR_GROWTH' : 'MENTOR_PRIVATE_COHORT')
      : (user.subscriptionPlan || 'FREE');

    if (currentKey === selectedValue) return;

    if (!window.confirm(`Change tier for ${user.name} (${user.email}) to ${label}?`)) return;
    
    try {
      setIsModifyingPlan(user.id);
      const { data } = await api.patch(`/admin/users/${user.id}/subscription`, {
        plan: newPlan,
        mentorTier: newMentorTier,
        reason: 'ADMIN_GRANTED',
        notes: `Admin updated tier to ${label}`
      });
      toast.success(data.message || `Tier updated to ${label} successfully`);
      
      const newMaxStudents = newMentorTier === 'MEGA' ? 1000 : newMentorTier === 'GROWTH' ? 200 : newMentorTier ? 80 : user.mentorMaxStudents;
      const newMaxCohorts = newMentorTier === 'MEGA' ? 999 : newMentorTier === 'GROWTH' ? 5 : newMentorTier ? 2 : user.mentorMaxCohorts;

      setUsers(users.map(u => {
        if (u.id === user.id) {
          return {
            ...u,
            subscriptionPlan: newPlan,
            mentorTier: newMentorTier || u.mentorTier,
            mentorMaxStudents: newMaxStudents,
            mentorMaxCohorts: newMaxCohorts,
            role: newPlan === 'MENTOR' ? 'MENTOR' : u.role
          };
        }
        return u;
      }));
      
      // Dispatch data change to update other tabs and dashboard
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('jahzjournal:data-changed', {
          detail: { timestamp: Date.now() }
        }));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update user subscription plan');
    } finally {
      setIsModifyingPlan(null);
    }
  };

  const executeImpersonation = async (targetUser) => {
      const reason = window.prompt(`Please provide a reason for temporarily signing in as ${targetUser.email}:`);
      if (!reason) return;
      
      try {
          await api.post(`/admin/impersonate/${targetUser.id}`, { reason });
          window.location.href = '/dashboard';
      } catch (e) {
          toast.error(e.response?.data?.message || 'Could not sign in as this user.');
      }
  };

  const getPlanBadgeClass = (plan, mentorTier) => {
    if (plan === 'MENTOR') {
      if (mentorTier === 'MEGA' || mentorTier === 'MEGA_ACADEMY') {
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      }
      if (mentorTier === 'GROWTH' || mentorTier === 'GROWTH_COMMUNITY') {
        return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
      }
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    }
    switch (plan) {
      case 'PRO_SYNC':
        return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      case 'PRO':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'STARTER':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      default:
        return 'bg-surface text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage platform users, roles, and subscriptions across all account tiers.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
             <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
             <input 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               placeholder="Search by name or email..."
               className="pl-10 pr-4 py-2 bg-surface border border-border rounded-lg text-sm w-full sm:w-56 focus:outline-none focus:border-emerald-500"
             />
          </div>

          {/* Plan Filter */}
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-xs font-bold text-foreground focus:outline-none focus:border-emerald-500 cursor-pointer"
            title="Filter by subscription tier"
          >
            <option value="">All Plans</option>
            <optgroup label="Trader Tiers">
              <option value="FREE">Free</option>
              <option value="STARTER">Starter</option>
              <option value="PRO">Pro</option>
              <option value="PRO_SYNC">Pro Sync</option>
            </optgroup>
            <optgroup label="Mentor Tiers">
              <option value="MENTOR">All Mentors</option>
              <option value="MENTOR_PRIVATE_COHORT">Private Cohort (80 Max)</option>
              <option value="MENTOR_GROWTH">Growth Community (200 Max)</option>
              <option value="MENTOR_MEGA">Mega Academy (1,000 Max)</option>
            </optgroup>
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-surface border border-border rounded-lg text-xs font-bold text-foreground focus:outline-none focus:border-emerald-500 cursor-pointer"
            title="Filter by user role"
          >
            <option value="">All Roles</option>
            <option value="TRADER">Trader</option>
            <option value="MENTOR">Mentor</option>
            <option value="MODERATOR">Moderator</option>
            <option value="SUPPORT">Support</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>

          {(planFilter || roleFilter || searchTerm) && (
            <button
              onClick={() => { setPlanFilter(''); setRoleFilter(''); setSearchTerm(''); }}
              className="px-2.5 py-2 bg-surface border border-border hover:bg-surface-muted rounded-lg text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1"
              title="Clear all filters"
            >
              <X size={14} /> Clear
            </button>
          )}

          <button
            onClick={() => fetchUsers(searchTerm, page, planFilter, roleFilter)}
            className="p-2 bg-surface border border-border hover:bg-surface-muted rounded-lg text-muted-foreground hover:text-foreground transition"
            title="Refresh Users"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-emerald-500' : ''} />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-semibold">User</th>
                <th className="px-6 py-3 font-semibold">Role</th>
                <th className="px-6 py-3 font-semibold">Subscription Plan</th>
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
                      <option value="TRADER">Trader</option>
                      <option value="MENTOR">Mentor</option>
                      <option value="MODERATOR">Moderator</option>
                      <option value="SUPPORT">Support</option>
                      <option value="ADMIN">Admin</option>
                      <option value="SUPER_ADMIN">Super Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const isMentor = user.subscriptionPlan === 'MENTOR' || user.role === 'MENTOR';
                      const currentVal = isMentor
                        ? (user.mentorTier === 'MEGA' || user.mentorTier === 'MEGA_ACADEMY' ? 'MENTOR_MEGA'
                          : user.mentorTier === 'GROWTH' || user.mentorTier === 'GROWTH_COMMUNITY' ? 'MENTOR_GROWTH'
                          : 'MENTOR_PRIVATE_COHORT')
                        : (user.subscriptionPlan || 'FREE');
                      
                      return (
                        <div className="flex flex-col gap-1">
                          <select
                            value={currentVal}
                            onChange={(e) => handlePlanChange(user, e.target.value)}
                            disabled={isModifyingPlan === user.id}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-extrabold outline-none cursor-pointer ${getPlanBadgeClass(user.subscriptionPlan, user.mentorTier)}`}
                            title="Change user subscription tier"
                          >
                            <optgroup label="Trader Tiers">
                              <option value="FREE">FREE</option>
                              <option value="STARTER">STARTER</option>
                              <option value="PRO">PRO</option>
                              <option value="PRO_SYNC">PRO SYNC</option>
                            </optgroup>
                            <optgroup label="Mentor Tiers">
                              <option value="MENTOR_PRIVATE_COHORT">Private Cohort (80 Max)</option>
                              <option value="MENTOR_GROWTH">Growth Community (200 Max)</option>
                              <option value="MENTOR_MEGA">Mega Academy (1,000 Max)</option>
                            </optgroup>
                          </select>
                          {isMentor && (
                            <span className="text-[10px] text-muted-foreground font-semibold px-1">
                              Cap: {user.mentorMaxStudents || 80} students • {user.mentorMaxCohorts || 2} cohorts
                            </span>
                          )}
                        </div>
                      );
                    })()}
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
                       <button onClick={() => executeImpersonation(user)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md transition" title="Log in as User (Super Admin)">
                         <UserSquare2 size={16} />
                       </button>
                       <button onClick={() => setSelectedUserTimeline(user)} className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-md transition" title="View User History & Notes">
                         <ScanLine size={16} />
                       </button>
                       <button onClick={() => setSelectedUserAi(user)} className="p-1.5 text-purple-500 hover:bg-purple-500/10 rounded-md transition" title="View AI Usage">
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
