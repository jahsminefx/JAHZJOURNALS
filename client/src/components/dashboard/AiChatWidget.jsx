import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, ChevronDown, AlertCircle, GripHorizontal } from 'lucide-react';
import api from '../../utils/api';
import useDraggable from '../../hooks/useDraggable';

const AiChatWidget = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am JAHZ AI. I can securely query your analytics. Ask me things like "What is my win rate?" or "Am I profitable on Fridays?"' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [chatMode, setChatMode] = useState('ANALYTICS');
  const endRef = useRef(null);

  // Draggable hook integration
  const { 
    pos, 
    isDragging, 
    hasMoved, 
    containerRef, 
    pointerHandlers, 
    style 
  } = useDraggable('jahzjournals-widget-pos-ai', { x: 0, y: 0 });

  const handleButtonClick = (e) => {
    e.stopPropagation();
    if (!hasMoved) {
      setIsOpen((prev) => !prev);
    }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const newMsgs = [...messages, { role: 'user', content: input.trim() }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', { messages: newMsgs, chatMode });
      setMessages([...newMsgs, { role: 'assistant', content: res.data.message }]);
    } catch (error) {
      setMessages([...newMsgs, { role: 'assistant', content: 'Connection issue. Could not reach analytics.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      style={style}
      className={`fixed bottom-6 right-6 z-50 flex flex-col items-end transition-transform duration-75 select-none ${
        isDragging ? 'scale-105 cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Draggable Chat Modal */}
      {isOpen && (
        <div className="bg-surface border border-border shadow-2xl rounded-2xl w-80 sm:w-96 mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          {/* Header & Drag Handle */}
          <div 
            {...pointerHandlers}
            className="bg-slate-900 flex justify-between items-center p-4 cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <GripHorizontal size={16} className="text-gray-400" />
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Bot size={20} className="text-amber-400" /> JAHZ AI Chat
                </h3>
              </div>
              <div className="flex bg-slate-800 rounded-lg p-1 mt-2">
                 <button onClick={() => setChatMode('ANALYTICS')} className={`flex-1 text-xs py-1 rounded transition ${chatMode === 'ANALYTICS' ? 'bg-indigo-500 text-white font-bold' : 'text-gray-400 hover:text-white'}`}>Analytics</button>
                 <button onClick={() => setChatMode('SUPPORT')} className={`flex-1 text-xs py-1 rounded transition ${chatMode === 'SUPPORT' ? 'bg-indigo-500 text-white font-bold' : 'text-gray-400 hover:text-white'}`}>Support</button>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition self-start p-1" aria-label="Close JAHZ AI chat">
              <ChevronDown />
            </button>
          </div>
          
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-2 flex items-start gap-2">
            <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-500 font-medium leading-snug">
              {chatMode === 'ANALYTICS' ? 'Analytics queries evaluate your private DB metrics securely.' : 'Product Support Mode answers platform usage queries natively.'}
            </p>
          </div>

          <div className="flex-1 p-4 overflow-y-auto min-h-[300px] max-h-[400px] bg-background space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-amber-400'}`}>
                   {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-3 rounded-xl text-sm shadow-xs ${m.role === 'user' ? 'bg-indigo-500 text-white rounded-tr-none' : 'bg-surface-muted text-foreground border border-border rounded-tl-none'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center flex-shrink-0"><Bot size={16} /></div>
                <div className="p-3 bg-surface-muted border border-border rounded-xl rounded-tl-none text-sm text-muted animate-pulse">Typing...</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="p-3 bg-surface border-t border-border flex items-center gap-2">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={chatMode === 'ANALYTICS' ? "Ask about your metrics..." : "Ask how to use the app..."}
              className="flex-1 bg-surface-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-indigo-500"
            />
            <button onClick={handleSend} disabled={loading || !input.trim()} className="p-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-50 transition">
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Floating Bot Button */}
      {!isOpen && (
        <button 
          type="button"
          {...pointerHandlers}
          onClick={handleButtonClick}
          className="bg-slate-900 dark:bg-gray-800 text-white p-4 rounded-full shadow-2xl hover:scale-105 transition hover:shadow-indigo-500/20 active:scale-95 group flex items-center justify-center"
          aria-label="Open JAHZ AI Assistant Chat"
          title="Drag to move • Click to open JAHZ AI Chat"
        >
          <Bot size={28} className="text-amber-400 group-hover:animate-bounce" />
        </button>
      )}
    </div>
  );
};

export default AiChatWidget;
