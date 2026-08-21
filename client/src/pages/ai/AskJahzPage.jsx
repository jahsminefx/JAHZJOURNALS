import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, AlertCircle, MessageSquare } from 'lucide-react';
import api from '../../utils/api';

const AskJahzPage = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am JAHZ AI. I can securely query your analytics or help you with the platform. What would you like to know?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatMode, setChatMode] = useState('ANALYTICS');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      const errorText = error.response?.data?.message || error.message || 'Jahz AI couldn\'t process your request right now. Please try again.';
      setMessages([...newMsgs, { role: 'assistant', content: `⚠️ ${errorText}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-border px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 text-blue-500 rounded-lg">
            <MessageSquare size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">JAHZ AI</h1>
            <p className="text-xs text-muted">Your personal AI trading analyst</p>
          </div>
        </div>
        
        <div className="flex bg-surface-muted border border-border p-1 rounded-lg">
           <button 
             onClick={() => setChatMode('ANALYTICS')} 
             className={`px-4 py-1.5 text-sm rounded-md transition-colors ${chatMode === 'ANALYTICS' ? 'bg-blue-600 text-white shadow-sm' : 'text-muted hover:text-foreground'}`}
           >
             Analytics Mode
           </button>
           <button 
             onClick={() => setChatMode('SUPPORT')} 
             className={`px-4 py-1.5 text-sm rounded-md transition-colors ${chatMode === 'SUPPORT' ? 'bg-blue-600 text-white shadow-sm' : 'text-muted hover:text-foreground'}`}
           >
             Support Mode
           </button>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-blue-500/10 border-b border-blue-500/20 px-6 py-2 flex items-center justify-center gap-2 shrink-0">
        <AlertCircle size={14} className="text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-500 font-medium">
          {chatMode === 'ANALYTICS' 
            ? 'Analytics Mode evaluates your private DB metrics securely (e.g., "What is my win rate on EURUSD?").' 
            : 'Support Mode answers platform usage queries natively based on the JAHZJOURNALS documentation.'}
        </p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-amber-400'}`}>
                 {m.role === 'user' ? <User size={20} /> : <Bot size={24} />}
              </div>
              <div className={`p-4 rounded-2xl max-w-[85%] sm:max-w-[75%] shadow-sm leading-relaxed ${
                m.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-surface border border-border text-foreground rounded-tl-none'
              }`}>
                <p className="whitespace-pre-wrap text-sm md:text-base">{m.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Bot size={24} />
              </div>
              <div className="p-4 bg-surface border border-border rounded-2xl rounded-tl-none text-muted text-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-surface border-t border-border p-4 shrink-0">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={chatMode === 'ANALYTICS' ? "Ask about your metrics (e.g. 'Show me my best performing pairs')" : "Ask how to use the app..."}
            className="flex-1 bg-surface-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none max-h-32 min-h-[50px]"
            rows={1}
          />
          <button 
            onClick={handleSend} 
            disabled={loading || !input.trim()} 
            className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-900/20 hover:bg-blue-500 disabled:opacity-50 disabled:shadow-none transition-all"
          >
            <Send size={20} />
          </button>
        </div>
        <p className="text-center text-[10px] text-muted mt-2">JAHZ AI can verify patterns but double check significant analytical statements directly on the dashboard</p>
      </div>
    </div>
  );
};

export default AskJahzPage;
