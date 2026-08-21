import React from 'react';
import { Controller } from 'react-hook-form';
import DirectionSelect from '../DirectionSelect';

const inputStyle = "mt-1.5 block w-full bg-surface-muted border border-border rounded-xl py-2.5 px-3.5 text-sm text-foreground focus:outline-none focus:border-emerald-500 focus:bg-surface transition-all shadow-sm";

const TradeSetupSection = ({ register, control, accounts, status }) => {
  return (
    <section>
      <h3 className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 border-b border-border pb-2.5 mb-5 uppercase tracking-wider">Trade Setup</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div>
          <label htmlFor="quick-account-id" className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Account
          </label>
          <select id="quick-account-id" required {...register('tradingAccountId')} className={inputStyle}>
            {accounts.map((account) => <option key={account.id} value={account.id} className="bg-surface text-foreground">{account.name}</option>)}
          </select>
        </div>
        
        <div>
          <label htmlFor="quick-pair" className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Pair / Instrument
          </label>
          <input id="quick-pair" required {...register('pair')} className={`${inputStyle} uppercase font-mono font-bold`} placeholder="EURUSD" />
        </div>
        
        <div>
          <label htmlFor="quick-direction" className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Direction
          </label>
          <div className="mt-1.5">
            <Controller
              name="direction"
              control={control}
              render={({ field }) => (
                <DirectionSelect 
                  value={field.value} 
                  onChange={field.onChange} 
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>
        </div>

        <div>
          <label htmlFor="quick-status" className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Status
          </label>
          <select id="quick-status" {...register('status')} className={inputStyle}>
            <option value="PLANNED" className="bg-surface text-foreground">Planned</option>
            <option value="ACTIVE" className="bg-surface text-foreground">Open (Active)</option>
            <option value="CLOSED" className="bg-surface text-foreground">Closed</option>
            <option value="CANCELLED" className="bg-surface text-foreground">Cancelled</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="quick-entry-time" className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
            Entry Time
          </label>
          <input id="quick-entry-time" type="datetime-local" {...register('entryTime')} className={inputStyle} />
        </div>

        {status === 'CLOSED' && (
          <div>
            <label htmlFor="quick-exit-time" className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
              Exit Time
            </label>
            <input id="quick-exit-time" type="datetime-local" {...register('exitTime')} className={inputStyle} />
          </div>
        )}
      </div>
    </section>
  );
};

export default TradeSetupSection;
