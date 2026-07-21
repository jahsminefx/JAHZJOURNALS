import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { ShieldCheck, History, Search } from 'lucide-react';
import { format } from 'date-fns';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchLogs = async (pageNum = 1) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/admin/audit?page=${pageNum}&limit=50`);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page);
  }, [page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
        <p className="text-muted-foreground text-sm mt-1">Immutable record of administrative and destructive actions.</p>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="p-4 border-b border-border bg-surface flex items-center gap-2 text-amber-500 text-sm">
           <ShieldCheck size={16} /> <strong>Security Notice:</strong> Audit Logs are immutable and cannot be deleted or modified through the UI.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-semibold">Timestamp</th>
                <th className="px-6 py-3 font-semibold">Admin</th>
                <th className="px-6 py-3 font-semibold">Action</th>
                <th className="px-6 py-3 font-semibold">Resource</th>
                <th className="px-6 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                 <tr>
                   <td colSpan="5" className="px-6 py-8 text-center text-muted-foreground">Loading audit logs...</td>
                 </tr>
              ) : logs.length === 0 ? (
                 <tr>
                   <td colSpan="5" className="px-6 py-8 text-center text-muted-foreground">No audit logs found.</td>
                 </tr>
              ) : logs.map(log => (
                <tr key={log.id} className="hover:bg-surface-muted/50 transition whitespace-nowrap">
                  <td className="px-6 py-4 text-xs text-muted-foreground">
                    {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-foreground">{log.admin?.name || 'System Admin'}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{log.ipAddress || 'Unknown IP'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-surface-muted text-emerald-400 font-medium rounded-md text-xs border border-border">
                       {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                     {log.resource} <span className="text-muted-foreground text-xs font-mono ml-2">[{log.resourceId}]</span>
                  </td>
                  <td className="px-6 py-4 text-xs max-w-xs truncate" title={`Old: ${log.oldValue} | New: ${log.newValue}`}>
                     {log.newValue ? (
                       <span>Changed to <strong className="text-foreground">{log.newValue}</strong></span>
                     ) : (
                       <span className="text-muted-foreground">Logged securely.</span>
                     )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */
        !loading && total > 50 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
             <span className="text-xs text-muted-foreground">Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of {total} logs</span>
             <div className="flex gap-2">
                <button 
                  disabled={page === 1} 
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 rounded-md border border-border text-xs disabled:opacity-50 hover:bg-surface-muted"
                >
                  Previous
                </button>
                <button 
                  disabled={page * 50 >= total}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 rounded-md border border-border text-xs disabled:opacity-50 hover:bg-surface-muted"
                >
                  Next
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
