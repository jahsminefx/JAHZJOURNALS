import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const severityOptions = ['MINOR', 'MODERATE', 'MAJOR'];

const RuleViolationEditor = ({ ruleViolations, setRuleViolations, activeRules }) => {
  const [showViolations, setShowViolations] = useState(ruleViolations.length > 0);

  const addRuleViolation = () => {
    if (activeRules.length === 0) {
      toast.error('Create an active trading rule first to start tracking.');
      return;
    }
    setRuleViolations((current) => [
      ...current,
      { tradeRuleId: activeRules[0].id, severity: 'MINOR', note: '' },
    ]);
    setShowViolations(true);
  };

  const updateViolation = (index, field, value) => {
    setRuleViolations((current) => current.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };
  
  const removeViolation = (index) => {
    const nextArr = ruleViolations.filter((_, i) => i !== index);
    setRuleViolations(nextArr);
    if (nextArr.length === 0) setShowViolations(false);
  };

  return (
    <section className="bg-surface-muted p-6 rounded-xl border border-border space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium text-emerald-600 dark:text-emerald-400">Rules Broken</h3>
          <p className="text-sm text-muted">Were any of your trading rules bent or broken?</p>
        </div>
        <div className="flex bg-surface p-1 rounded-lg border border-border self-start">
          <button type="button" onClick={() => setShowViolations(false)} className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${!showViolations ? 'bg-green-500 text-gray-900' : 'text-muted hover:text-foreground'}`}>No</button>
          <button type="button" onClick={() => { setShowViolations(true); if (ruleViolations.length === 0) addRuleViolation(); }} className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${showViolations ? 'bg-red-500 text-white' : 'text-muted hover:text-foreground'}`}>Yes</button>
        </div>
      </div>

      {showViolations && (
        <div className="space-y-3 mt-4">
          {ruleViolations.map((violation, index) => (
            <div key={index} className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_2fr_auto] gap-3 bg-surface p-3 rounded-lg border border-border items-center">
              <select value={violation.tradeRuleId} onChange={(e) => updateViolation(index, 'tradeRuleId', e.target.value)} className="bg-background border border-border rounded-md py-2 px-3 text-sm focus:border-green-500 outline-none">
                {activeRules.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <select value={violation.severity} onChange={(e) => updateViolation(index, 'severity', e.target.value)} className="bg-background border border-border rounded-md py-2 px-3 text-sm focus:border-green-500 outline-none">
                {severityOptions.map((sev) => <option key={sev} value={sev}>{sev}</option>)}
              </select>
              <input value={violation.note || ''} onChange={(e) => updateViolation(index, 'note', e.target.value)} placeholder="What happened..." className="bg-background border border-border rounded-md py-2 px-3 text-sm focus:border-green-500 outline-none" />
              <button type="button" onClick={() => removeViolation(index)} className="text-red-400 hover:text-red-300 p-2">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addRuleViolation} className="text-sm font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300">+ Add another rule</button>
        </div>
      )}
    </section>
  );
};

export default RuleViolationEditor;
