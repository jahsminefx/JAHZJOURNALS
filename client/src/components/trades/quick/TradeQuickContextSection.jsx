import React from 'react';
import { Trash2 } from 'lucide-react';

const TradeQuickContextSection = ({ register, screenshotFiles, setScreenshotFiles }) => {
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
      <h3 className="text-lg font-medium text-green-400 border-b border-border pb-2 mb-4">Quick Context</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <label className="text-sm text-muted">
          Strategy
          <input {...register('strategyName')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500" placeholder="e.g. ICT, Support & Resistance" />
        </label>
        <label className="text-sm text-muted">
          Setup
          <input {...register('setupType')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500" placeholder="e.g. Liquidity Sweep" />
        </label>
        <label className="text-sm text-muted md:col-span-2">
          Entry Reason
          <textarea rows="2" {...register('entryReason')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500 resize-none" placeholder="What made you enter this trade?" />
        </label>
      </div>

      <div className="bg-surface-muted p-4 border border-border rounded-lg">
        <p className="text-sm font-medium text-muted mb-2">Screenshot (Optional)</p>
        <input type="file" accept="image/*" multiple onChange={addScreenshotFile} className="block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-green-500 file:px-4 file:py-2 file:font-medium file:text-gray-900" />
        
        {screenshotFiles.length > 0 && (
          <div className="mt-4 space-y-3">
            {screenshotFiles.map((screenshot, index) => (
              <div key={`${screenshot.file.name}-${index}`} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-background p-3 items-center">
                <div>
                  <p className="text-sm font-medium text-foreground">{screenshot.file.name}</p>
                  <p className="text-xs text-muted">{Math.round(screenshot.file.size / 1024)} KB</p>
                </div>
                <button type="button" onClick={() => setScreenshotFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-red-400 hover:text-red-300 justify-self-end">
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
