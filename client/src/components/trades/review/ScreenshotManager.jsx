import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../utils/api';

const screenshotTypeOptions = [
  'HIGHER_TIMEFRAME_ANALYSIS', 'BEFORE_ENTRY', 'ENTRY', 
  'DURING_TRADE', 'EXIT', 'POST_ANALYSIS', 'MARKED_CHART'
];

const ScreenshotManager = ({ existingScreenshots, setExistingScreenshots, screenshotFiles, setScreenshotFiles }) => {
  const [deletingScreenshotId, setDeletingScreenshotId] = useState(null);

  const addScreenshotFile = (event) => {
    const files = Array.from(event.target.files || []);
    setScreenshotFiles((current) => [
      ...current,
      ...files.map((file) => ({ file, screenshotType: 'POST_ANALYSIS', note: '' })),
    ]);
    event.target.value = '';
  };

  const updateScreenshotFile = (index, field, value) => {
    setScreenshotFiles((current) => current.map((screenshot, itemIndex) => (
      itemIndex === index ? { ...screenshot, [field]: value } : screenshot
    )));
  };

  const deleteExistingScreenshot = async (screenshotId) => {
    if (!window.confirm('Delete this screenshot from the trade and Cloudinary?')) return;

    setDeletingScreenshotId(screenshotId);
    try {
      await api.delete(`/screenshots/${screenshotId}`);
      setExistingScreenshots((current) => current.filter((screenshot) => screenshot.id !== screenshotId));
      toast.success('Screenshot deleted');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete screenshot');
    } finally {
      setDeletingScreenshotId(null);
    }
  };

  const removePendingScreenshot = (index) => {
    setScreenshotFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <section className="bg-surface-muted p-6 rounded-xl border border-border space-y-4">
      <h3 className="text-lg font-medium text-emerald-600 dark:text-emerald-400">Screenshots</h3>
      
      {existingScreenshots.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {existingScreenshots.map((screenshot) => (
            <div key={screenshot.id} className="rounded-lg border border-border bg-surface p-3">
              <img src={screenshot.imageUrl} alt={screenshot.note || screenshot.screenshotType} className="aspect-video w-full rounded-md object-cover border border-border" />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted">{screenshot.screenshotType.replace('_', ' ')}</p>
                <button type="button" disabled={deletingScreenshotId === screenshot.id} onClick={() => deleteExistingScreenshot(screenshot.id)} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-60">
                  {deletingScreenshotId === screenshot.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
              {screenshot.note && <p className="text-xs text-muted mt-1">{screenshot.note}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="pt-4 mt-4 border-t border-border">
        <input type="file" accept="image/*" multiple onChange={addScreenshotFile} className="block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:font-medium file:text-emerald-400 dark:file:bg-gray-700" />
      </div>

      {screenshotFiles.length > 0 && (
        <div className="space-y-3 mt-4">
          {screenshotFiles.map((screenshot, index) => (
            <div key={`${screenshot.file.name}-${index}`} className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_auto] gap-3 rounded-lg border border-border bg-surface p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{screenshot.file.name}</p>
                <p className="text-xs text-muted">{Math.round(screenshot.file.size / 1024)} KB</p>
                <input value={screenshot.note} onChange={(e) => updateScreenshotFile(index, 'note', e.target.value)} placeholder="Screenshot note..." className="mt-2 w-full bg-background border border-border rounded-md py-1.5 px-3 text-sm outline-none focus:border-green-500" />
              </div>
              <select value={screenshot.screenshotType} onChange={(e) => updateScreenshotFile(index, 'screenshotType', e.target.value)} className="bg-background border border-border rounded-md py-1.5 px-3 text-sm outline-none focus:border-green-500 self-start">
                {screenshotTypeOptions.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
              </select>
              <button type="button" onClick={() => removePendingScreenshot(index)} className="text-red-400 hover:text-red-300 justify-self-start self-start p-1.5">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default ScreenshotManager;
