import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, Sparkles, LineChart, BookOpen, X } from 'lucide-react';

const FloatingQuickActions = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleAction = (path) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="lg:hidden fixed bottom-5 right-5 z-40 pb-safe">
      {/* Dimmed backdrop when open */}
      {open && (
        <div 
          onClick={() => setOpen(false)} 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-fade-in z-30" 
        />
      )}

      {/* Floating Action Menu */}
      <div className="relative z-40 flex flex-col items-end gap-3">
        {open && (
          <div className="flex flex-col items-end gap-2.5 animate-slide-up">
            <button
              onClick={() => handleAction('/trades/new')}
              className="flex items-center gap-2.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-full shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
            >
              <span>+ New Trade</span>
              <Briefcase size={16} />
            </button>

            <button
              onClick={() => handleAction('/ai')}
              className="flex items-center gap-2.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-full shadow-lg shadow-indigo-600/25 active:scale-95 transition-all"
            >
              <span>Ask JAHZ AI</span>
              <Sparkles size={16} />
            </button>

            <button
              onClick={() => handleAction('/weekly-review')}
              className="flex items-center gap-2.5 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-bold text-xs rounded-full shadow-lg active:scale-95 transition-all"
            >
              <span>Weekly Journal</span>
              <BookOpen size={16} />
            </button>

            <button
              onClick={() => handleAction('/analytics')}
              className="flex items-center gap-2.5 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-bold text-xs rounded-full shadow-lg active:scale-95 transition-all"
            >
              <span>Analytics</span>
              <LineChart size={16} />
            </button>
          </div>
        )}

        {/* Main Floating Trigger Button */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`flex items-center justify-center h-13 w-13 rounded-full font-bold text-white shadow-xl transition-all active:scale-90 ${
            open 
              ? 'bg-gray-800 border border-gray-700 text-gray-300 rotate-90' 
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
          }`}
          aria-label="Quick Actions"
        >
          {open ? <X size={22} /> : <Plus size={24} className="stroke-[2.5]" />}
        </button>
      </div>
    </div>
  );
};

export default FloatingQuickActions;
