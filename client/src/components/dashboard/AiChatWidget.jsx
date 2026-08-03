import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, ChevronDown, AlertCircle, GripHorizontal } from 'lucide-react';
import api from '../../utils/api';

const AiChatWidget = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am JAHZ AI. I can securely query your analytics. Ask me things like "What is my win rate?" or "Am I profitable on Fridays?"' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [chatMode, setChatMode] = useState('ANALYTICS');
  const endRef = useRef(null);

  // Draggable position state
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  const handlePointerDown = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartRef.current = { x: clientX - pos.x, y: clientY - pos.y };

    const handlePointerMove = (moveEvt) => {
      if (!isDraggingRef.current) return;
      const curX = moveEvt.touches ? moveEvt.touches[0].clientX : moveEvt.clientX;
      const curY = moveEvt.touches ? moveEvt.touches[0].clientY : moveEvt.clientY;

      const newX = curX - dragStartRef.current.x;
      const newY = curY - dragStartRef.current.y;

      if (Math.abs(newX - pos.x) > 4 || Math.abs(newY - pos.y) > 4) {
        hasMovedRef.current = true;
      }

      setPos({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
  };

  const handleButtonClick = () => {
    if (!hasMovedRef.current) {
      setIsOpen(true);
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
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end transition-transform duration-75"
    >
      {isOpen && (
        <div className="bg-surface border border-border shadow-2xl rounded-2xl w-80 sm:w-96 mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          <div 
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            className="bg-slate-900 flex justify-between items-center p-4 cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <GripHorizontal size={16} className="text-gray-400" />
                <h3 className="font-bold text-white flex items-center gap-2"><Bot size={20} className="text-amber-400" /> JAHZ AI Chat</h3>
              </div>
              <div className="flex bg-slate-800 rounded-lg p-1 mt-2">
                 <button onClick={() => setChatMode('ANALYTICS')} className={`flex-1 text-xs py-1 rounded transition ${chatMode === 'ANALYTICS' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}>Analytics</button>
                 <button onClick={() => setChatMode('SUPPORT')} className={`flex-1 text-xs py-1 rounded transition ${chatMode === 'SUPPORT' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}>Support</button>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition self-start"><ChevronDown /></button>
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
                <div className={`p-3 rounded-lg text-sm shadow-sm ${m.role === 'user' ? 'bg-indigo-500 text-white rounded-tr-none' : 'bg-surface-muted text-foreground border border-border rounded-tl-none'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center flex-shrink-0"><Bot size={16} /></div>
                <div className="p-3 bg-surface-muted border border-border rounded-lg rounded-tl-none text-sm text-muted animate-pulse">Typing...</div>
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
              className="flex-1 bg-surface-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-indigo-500"
            />
            <button onClick={handleSend} disabled={loading || !input.trim()} className="p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition">
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {!isOpen && (
        <div
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
          className="cursor-grab active:cursor-grabbing"
        >
          <button 
            onClick={handleButtonClick}
            className="bg-slate-900 dark:bg-gray-800 text-white p-4 rounded-full shadow-xl hover:scale-105 transition hover:shadow-indigo-500/20 active:scale-95 group flex items-center justify-center"
            title="Drag to move • Click to open JAHZ AI Chat"
          >
            <Bot size={28} className="text-amber-400 group-hover:animate-bounce" />
          </button>
        </div>
      )}
    </div>
  );
};

export default AiChatWidget;
