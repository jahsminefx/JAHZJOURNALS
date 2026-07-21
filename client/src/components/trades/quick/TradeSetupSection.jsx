import React from 'react';
import { Controller } from 'react-hook-form';
import DirectionSelect from '../DirectionSelect';

const TradeSetupSection = ({ register, control, accounts, status }) => {
  return (
    <section>
      <h3 className="text-lg font-medium text-emerald-600 dark:text-emerald-400 border-b border-border pb-2 mb-4">Trade Setup</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <label className="text-sm text-muted">
          Account
          <select required {...register('tradingAccountId')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500">
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
        
        <label className="text-sm text-muted">
          Pair / Instrument
          <input required {...register('pair')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500 uppercase" placeholder="EURUSD" />
        </label>
        
        <label className="text-sm text-muted">
          Direction
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
        </label>

        <label className="text-sm text-muted">
          Status
          <select {...register('status')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500">
            <option value="PLANNED">Planned</option>
            <option value="ACTIVE">Open (Active)</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
        
        <label className="text-sm text-muted">
          Entry Time
          <input type="datetime-local" {...register('entryTime')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500" />
        </label>

        {status === 'CLOSED' && (
          <label className="text-sm text-muted">
            Exit Time
            <input type="datetime-local" {...register('exitTime')} className="mt-1 block w-full bg-surface border border-border rounded-md py-2 px-3 focus:outline-none focus:border-green-500" />
          </label>
        )}
      </div>
    </section>
  );
};

export default TradeSetupSection;
