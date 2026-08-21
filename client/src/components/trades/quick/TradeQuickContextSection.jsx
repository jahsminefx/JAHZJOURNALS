import React from 'react';
import { Trash2 } from 'lucide-react';

const inputStyle = "mt-1.5 block w-full bg-surface-muted border border-border rounded-xl py-2.5 px-3.5 text-sm text-foreground focus:outline-none focus:border-emerald-500 focus:bg-surface transition-all shadow-sm";

const TradeQuickContextSection = ({ register, watch, strategies = [], screenshotFiles, setScreenshotFiles }) => {
  const addScreenshotFile = (event) => {
    const files = Array.from(event.target.files || []);
    setScreenshotFiles((current) => [
      ...current,
      ...files.map((file) => ({ file, screenshotType: 'MARKED_CHART', note: '' })),
    ]);
    event.target.value = '';
  };

  return (
    <section>
      <h3 className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 border-b border-border pb-2.5 mb-5 uppercase tracking-wider">Quick Context</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <div>
          <label htmlFor="quick-strategy-id" className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Strategy
          </label>
          <select id="quick-strategy-id" {...register('strategyId')} className={inputStyle}>
            <option value="" className="bg-surface text-foreground">No Strategy</option>
            {strategies.map((s) => <option key={s.id} value={s.id} className="bg-surface text-foreground">{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="quick-setup-id" className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Setup
          </label>
          <select id="quick-setup-id" {...register('setupId')} disabled={!watch('strategyId')} className={`${inputStyle} disabled:opacity-50`}>
            <option value="" className="bg-surface text-foreground">No Setup</option>
            {strategies.find(s => s.id === watch('strategyId'))?.setups?.map(su => (
              <option key={su.id} value={su.id} className="bg-surface text-foreground">{su.name}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="quick-entry-reason" className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Entry Reason
          </label>
          <textarea id="quick-entry-reason" rows="2" {...register('entryReason')} className={`${inputStyle} resize-none`} placeholder="What made you enter this trade?" />
        </div>
      </div>

      <div className="bg-surface-muted p-5 border border-border rounded-2xl shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Screenshot (Optional)</p>
        <input type="file" accept="image/*" multiple onChange={addScreenshotFile} className="block w-full text-xs text-muted file:mr-4 file:rounded-xl file:border file:border-border file:bg-emerald-500 file:px-4 file:py-2 file:font-bold file:text-slate-950 hover:file:bg-emerald-400 cursor-pointer" />
        
        {screenshotFiles.length > 0 && (
          <div className="mt-4 space-y-3">
            {screenshotFiles.map((screenshot, index) => (
              <div key={`${screenshot.file.name}-${index}`} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl bg-surface border border-border p-3 items-center shadow-sm">
                <div>
                  <p className="text-sm font-medium text-foreground">{screenshot.file.name}</p>
                  <p className="text-xs text-muted">{Math.round(screenshot.file.size / 1024)} KB</p>
                </div>
                <button type="button" onClick={() => setScreenshotFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-red-400 hover:text-red-300 justify-self-end p-2">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default TradeQuickContextSection;
