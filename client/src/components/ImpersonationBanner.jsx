import React, { useState } from 'react';
import { useAuth } from '../context/useAuth';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { AlertTriangle, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ImpersonationBanner = () => {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    if (!user || (!user.isImpersonating && !user.impersonatorId)) return null;

    const handleRevert = async () => {
        setLoading(true);
        try {
            await api.post('/auth/revert-impersonation');
            toast.success('Successfully restored SUPER_ADMIN credentials.');
            await refreshUser();
            navigate('/admin');
        } catch (e) {
            toast.error('Reversion failure. Absolute session termination invoked.');
            window.location.href = '/login';
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-red-500 text-white w-full py-2.5 px-3 sm:px-4 shadow-[0_0_20px_rgba(239,68,68,0.5)] z-[9999] relative flex flex-col md:flex-row justify-center items-center gap-2.5 md:gap-4 animate-in fade-in slide-in-from-top-4 font-sans">
            <div className="flex items-center gap-2 font-black uppercase tracking-wider sm:tracking-widest text-xs sm:text-sm text-center min-w-0 max-w-full">
                <AlertTriangle size={16} className="animate-pulse shrink-0" />
                <span className="break-all sm:break-normal">Impersonating: [{user.email}]</span>
            </div>

            <button 
                disabled={loading}
                onClick={handleRevert} 
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-1.5 bg-white text-red-500 rounded-md font-bold text-xs uppercase tracking-wide hover:bg-red-50 transition shadow-sm border border-red-400 disabled:opacity-50 shrink-0"
            >
                <LogOut size={14} />
                {loading ? 'Executing Reversion...' : 'Terminate Impersonation'}
            </button>
        </div>
    );
};

export default ImpersonationBanner;
