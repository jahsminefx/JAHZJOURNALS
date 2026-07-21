import React from 'react';
import { NavLink } from 'react-router-dom';
import { Camera, Compass, LineChart, MessageSquare, Target, BrainCircuit, Sparkles, BookOpen } from 'lucide-react';

const AiQuickActions = () => {
  const actions = [
    { title: 'Ask JAHZ', desc: 'Chat with your AI trading mentor', path: '/ai/ask-jahz', icon: <MessageSquare size={22} />, color: 'bg-blue-500/10 text-blue-500' },
    { title: 'Edge Finder', desc: 'Discover candidate edges in your data', path: '/ai/edge-finder', icon: <Target size={22} />, color: 'bg-purple-500/10 text-purple-500', premium: true },
    { title: 'Weekly Coach', desc: 'Generate your weekly performance plan', path: '/ai/weekly-coach', icon: <Compass size={22} />, color: 'bg-emerald-500/10 text-emerald-500' },
    { title: 'Review a Trade', desc: 'Get structured feedback on execution', path: '/ai/trade-reviews', icon: <LineChart size={22} />, color: 'bg-rose-500/10 text-rose-500' },
    { title: 'Trading Plan', desc: 'Build an objective system', path: '/ai/trading-plan', icon: <BookOpen size={22} />, color: 'bg-amber-500/10 text-amber-500', premium: true },
    { title: 'Psychology Insights', desc: 'View behavioral patterns', path: '/ai/psychology', icon: <BrainCircuit size={22} />, color: 'bg-indigo-500/10 text-indigo-500', premium: true },
    { title: 'Screenshot Reviews', desc: 'Visual entry analysis', path: '/ai/screenshots', icon: <Camera size={22} />, color: 'bg-cyan-500/10 text-cyan-500', premium: true }
  ];

  return (
    <div className="mb-10">
      <h2 className="text-xl font-bold text-foreground mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action, i) => (
          <NavLink 
            key={i} 
            to={action.path}
            className="group flex flex-col p-4 bg-surface border border-border rounded-xl shadow-sm hover:border-emerald-500/50 hover:shadow-emerald-500/10 transition-all text-left"
          >
            <div className={`p-3 w-12 h-12 rounded-lg flex items-center justify-center mb-3 ${action.color}`}>
              {action.icon}
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground group-hover:text-emerald-500 transition-colors">{action.title}</h3>
              {action.premium && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600">PRO</span>}
            </div>
            <p className="text-sm text-muted mt-1 leading-relaxed">{action.desc}</p>
          </NavLink>
        ))}
      </div>
    </div>
  );
};

export default AiQuickActions;
