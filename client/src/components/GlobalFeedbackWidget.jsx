import React, { useState } from 'react';
import { Headphones, X, GripHorizontal, LogIn, ExternalLink } from 'lucide-react';
import useDraggable from '../hooks/useDraggable';
import { useAuth } from '../context/useAuth';
import { useNavigate } from 'react-router-dom';
import SupportChatPanel from './support/SupportChatPanel';

const GlobalFeedbackWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Draggable hook integration
  const { 
    isDragging, 
    hasMoved, 
    containerRef, 
    pointerHandlers, 
    style 
  } = useDraggable('jahzjournals-widget-pos-feedback', { x: 0, y: 0 });

  const handleButtonClick = (e) => {
    e.stopPropagation();
    if (!hasMoved) {
      setIsOpen((prev) => !prev);
    }
  };

  return (
    <div
      ref={containerRef}
      style={style}
      className={`fixed bottom-20 right-5 lg:bottom-6 lg:right-6 z-[9999] transition-transform duration-75 select-none ${
        isDragging ? 'scale-105 cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Floating Action Button */}
      <button
        type="button"
        {...pointerHandlers}
        onClick={handleButtonClick}
        className={`p-3.5 md:p-4 rounded-full bg-emerald-600 text-white shadow-2xl hover:bg-emerald-500 transition-all flex items-center justify-center relative group active:scale-95 ${
          isOpen ? 'ring-4 ring-emerald-500/30' : ''
        }`}
        aria-label="Open Direct Support Chat"
        title="Drag to move • Click to chat with Support"
      >
        <Headphones size={22} className={isDragging ? 'animate-pulse' : ''} />
      </button>

      {/* Interactive Modal / Dialog */}
      {isOpen && (
        <div 
          className="absolute bottom-16 right-0 w-[min(440px,calc(100vw-24px))] h-[min(650px,calc(100dvh-85px))] min-h-[500px] max-h-[680px] bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-3 z-[9999]"
        >
          {/* Draggable Header */}
          <div 
            {...pointerHandlers}
            className="flex justify-between items-center bg-surface px-3.5 py-2.5 border-b border-border cursor-grab active:cursor-grabbing select-none shrink-0"
          >
            <div className="flex items-center gap-2 text-foreground">
              <GripHorizontal size={15} className="text-muted/60 hover:text-muted shrink-0" />
              <h3 className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                <Headphones size={15} className="text-emerald-500" />
                Direct Support Chat
              </h3>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/support');
                }}
                className="text-muted hover:text-foreground hover:bg-surface-muted p-1.5 rounded-lg transition"
                title="Open full Support Desk (/support)"
                aria-label="Open full Support Desk"
              >
                <ExternalLink size={14} />
              </button>
              <button 
                type="button" 
                onClick={() => setIsOpen(false)} 
                className="text-muted hover:text-foreground hover:bg-surface-muted p-1.5 rounded-lg transition-colors"
                aria-label="Close support modal"
                title="Close support modal"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 min-h-0 flex flex-col bg-background">
            {user ? (
              <SupportChatPanel
                compact={true}
                onExpand={() => {
                  setIsOpen(false);
                  navigate('/support');
                }}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                  <Headphones size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Log in for Direct Support</h4>
                  <p className="text-xs text-muted max-w-xs mt-1">
                    Direct 1-on-1 support chat with Super Admin is reserved for logged-in traders.
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/login');
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <LogIn size={13} />
                    <span>Log In</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/contact');
                    }}
                    className="px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-muted text-xs font-semibold text-muted hover:text-foreground transition"
                  >
                    General Contact
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalFeedbackWidget;
