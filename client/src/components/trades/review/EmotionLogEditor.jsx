import React from 'react';
import { Trash2 } from 'lucide-react';

const emotionColorMap = {
  CALM: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30',
  CONFIDENT: 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30',
  DISCIPLINED: 'bg-teal-500/20 text-teal-400 border-teal-500/30 hover:bg-teal-500/30',
  ANXIOUS: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30',
  GREEDY: 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30',
  FOMO: 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30',
  FEARFUL: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30',
  ANGRY: 'bg-red-900/40 text-red-400 border-red-900/50 hover:bg-red-900/50',
  REVENGE_MINDSET: 'bg-red-900/40 text-red-500 border-red-900/50 hover:bg-red-900/50',
  REGRETFUL: 'bg-gray-500/20 text-muted border-gray-500/30 hover:bg-gray-500/30',
  FRUSTRATED: 'bg-pink-500/20 text-pink-400 border-pink-500/30 hover:bg-pink-500/30',
};

const stageOptions = ['BEFORE_TRADE', 'DURING_TRADE', 'AFTER_TRADE'];
const emotionOptions = Object.keys(emotionColorMap);

const EmotionLogEditor = ({ emotionLogs, setEmotionLogs }) => {
  const addEmotion = () => {
    setEmotionLogs((current) => [
      ...current,
      { stage: 'BEFORE_TRADE', emotion: 'CALM', intensity: 5, note: '' },
    ]);
  };

  const updateEmotion = (index, field, value) => {
    setEmotionLogs((current) => current.map((emo, i) => i === index ? { ...emo, [field]: value } : emo));
  };
  
  const removeEmotion = (index) => {
    setEmotionLogs((current) => current.filter((_, i) => i !== index));
  };

  return (
    <section className="bg-surface-muted p-6 rounded-xl border border-border space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-emerald-600 dark:text-emerald-400">Your Mindset</h3>
          <p className="text-sm text-muted">How was your mind before, during, and after?</p>
        </div>
      </div>

      <div className="space-y-4">
        {emotionLogs.map((log, index) => (
          <div key={index} className="bg-surface p-4 rounded-lg border border-border flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            
            <div className="flex-1 w-full space-y-2 lg:space-y-0 lg:flex lg:gap-3 lg:items-center">
              <select value={log.stage} onChange={(e) => updateEmotion(index, 'stage', e.target.value)} className="w-full lg:w-40 bg-background border border-border rounded-md py-2 px-3 text-sm outline-none focus:border-green-500">
                {stageOptions.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
              
              <div className="flex-1 flex flex-wrap gap-2">
                {emotionOptions.map((emo) => {
                  const isSelected = log.emotion === emo;
                  const classes = isSelected 
                    ? emotionColorMap[emo] 
                    : 'bg-surface-muted text-muted border-border hover:bg-surface-muted';

                  return (
                    <button 
                      key={emo} 
                      type="button" 
                      onClick={() => updateEmotion(index, 'emotion', emo)}
                      className={`px-3 py-1 text-xs font-medium border rounded-full transition-colors cursor-pointer ${classes}`}
                    >
                      {emo.replace('_', ' ')}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-2 flex-1 lg:flex-none">
                <span className="text-xs text-muted w-12 text-right">Intensity:</span>
                <input 
                  type="number" 
                  min="1" max="10" 
                  value={log.intensity} 
                  onChange={(e) => updateEmotion(index, 'intensity', Number.parseInt(e.target.value, 10))} 
                  className="w-16 bg-background border border-border rounded-md py-1 px-2 text-sm text-center outline-none focus:border-green-500" 
                />
              </div>
              <input value={log.note || ''} onChange={(e) => updateEmotion(index, 'note', e.target.value)} placeholder="What was on your mind..." className="flex-1 lg:w-48 bg-background border border-border rounded-md py-1.5 px-3 text-sm outline-none focus:border-green-500" />
              <button type="button" onClick={() => removeEmotion(index)} className="text-red-400 hover:text-red-300 p-1">
                <Trash2 size={18} />
              </button>
            </div>

          </div>
        ))}

        <button type="button" onClick={addEmotion} className="text-sm font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 inline-flex items-center px-4 py-2 border border-emerald-500/30 rounded-lg bg-emerald-500/10">
          + Add Another Feeling
        </button>
      </div>
    </section>
  );
};

export default EmotionLogEditor;
