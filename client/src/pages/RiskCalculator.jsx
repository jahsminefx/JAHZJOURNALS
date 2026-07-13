import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Calculator } from 'lucide-react';

const RiskCalculator = () => {
  const { register, handleSubmit } = useForm({
    defaultValues: { balance: 10000, riskPercent: 1.0, stopLossPips: 20 }
  });
  const [results, setResults] = useState(null);

  const onSubmit = (data) => {
    const riskAmount = (parseFloat(data.balance) * parseFloat(data.riskPercent)) / 100;

    let lotSize = 0;
    const pips = parseFloat(data.stopLossPips);

    if (pips > 0) {
       lotSize = riskAmount / (pips * 10);
    }

    setResults({
      riskAmount: riskAmount.toFixed(2),
      lotSize: lotSize.toFixed(2),
    });
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 font-sans">
      <div className="bg-surface-muted p-6 rounded-xl shadow-lg border border-border">
        <div className="flex items-center space-x-3 border-b border-border pb-4 mb-6">
          <div className="p-2 bg-green-500/20 rounded-lg text-green-400">
            <Calculator size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Risk Calculator</h2>
            <p className="text-sm text-muted">Determine your exact position size before executing.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted">Account Balance ($)</label>
              <input type="number" step="0.01" {...register('balance')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 text-muted focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted">Risk (%)</label>
              <input type="number" step="0.1" {...register('riskPercent')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 text-muted focus:outline-none focus:border-green-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted">Stop Loss (Pips)</label>
              <input type="number" step="0.1" {...register('stopLossPips')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 text-muted focus:outline-none focus:border-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted">Pair Type</label>
              <select {...register('pairType')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 text-muted focus:outline-none focus:border-green-500">
                <option value="forex">Forex (Standard USD)</option>
                <option value="jpy">JPY Pair</option>
                <option value="indices">Indices</option>
              </select>
            </div>
          </div>

          <button type="submit" className="w-full py-3 bg-green-500 text-gray-900 font-bold rounded-lg hover:bg-green-400 transition-colors">
            Calculate Position Size
          </button>
        </form>
      </div>

      {results && (
        <div className="bg-surface-muted p-6 rounded-xl shadow-lg border border-green-500/50">
           <h3 className="text-lg font-bold text-foreground mb-4 border-b border-border pb-2">Calculation Results</h3>
           <div className="grid grid-cols-2 gap-6 text-center">
             <div className="bg-surface p-4 rounded-lg border border-border">
                <p className="text-sm text-muted mb-1">Capital at Risk</p>
                <p className="text-2xl font-bold text-red-400">${results.riskAmount}</p>
             </div>
             <div className="bg-surface p-4 rounded-lg border border-border">
                <p className="text-sm text-muted mb-1">Suggested Lot Size</p>
                <p className="text-2xl font-bold text-green-400">{results.lotSize}</p>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default RiskCalculator;
