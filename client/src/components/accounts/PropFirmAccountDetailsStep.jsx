import React from 'react';
import { useFormContext } from 'react-hook-form';
import TemplateSelector from './TemplateSelector';
import { CurrencyInput, SelectInput, TextInput } from './FormControls';
import { SUPPORTED_CURRENCIES } from '../../services/currencyConversionService';

const propFirmOptions = [
  'FTMO',
  'Funding Pips',
  'The 5ers',
  'Apex Trader Funding',
  'Topstep',
  'MyFundedFX',
  'FundedNext',
  'OTHER',
];

const enumLabel = (value) => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

const PropFirmAccountDetailsStep = ({ onApplyTemplate }) => {
  const { register, watch, formState: { errors } } = useFormContext();
  const firmName = watch('firmName');

  return (
    <div className="space-y-6">
      <TemplateSelector onApply={onApplyTemplate} />

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Account details</h3>
          <p className="mt-1 text-sm text-muted">Only the core setup details needed to create the account.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <TextInput label="Account name" error={errors.accountName?.message} {...register('accountName')} />
          <SelectInput label="Prop-firm name" error={errors.firmName?.message} {...register('firmName')}>
            <option value="">Select a prop firm</option>
            {propFirmOptions.map((firm) => (
              <option key={firm} value={firm}>{firm === 'OTHER' ? 'Other' : firm}</option>
            ))}
          </SelectInput>
          {firmName === 'OTHER' && (
            <TextInput label="Custom prop-firm name" error={errors.customFirmName?.message} {...register('customFirmName')} />
          )}
          <TextInput label="Programme or model name" error={errors.programmeName?.message} {...register('programmeName')} />
          <CurrencyInput label="Account size" error={errors.accountSize?.message} {...register('accountSize')} />
          <SelectInput label="Account currency" error={errors.currency?.message} {...register('currency')}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} ({c.symbol.trim()}) — {c.name}
              </option>
            ))}
          </SelectInput>
          <SelectInput label="Trading platform" error={errors.platform?.message} {...register('platform')}>
            {['MT4', 'MT5', 'CTRADER', 'MATCH_TRADER', 'TRADELOCKER', 'DXTRADE', 'RITHMIC', 'NINJATRADER', 'OTHER'].map((platform) => (
              <option key={platform} value={platform}>{enumLabel(platform)}</option>
            ))}
          </SelectInput>
          <SelectInput label="Evaluation type" error={errors.evaluationType?.message} {...register('evaluationType')}>
            <option value="ONE_STEP">One-step evaluation</option>
            <option value="TWO_STEP">Two-step evaluation</option>
            <option value="THREE_STEP">Three-step evaluation</option>
            <option value="INSTANT_FUNDED">Instant funded</option>
            <option value="ALREADY_FUNDED">Already funded</option>
          </SelectInput>
          <TextInput type="date" label="Account start date" error={errors.startDate?.message} {...register('startDate')} />
        </div>
      </section>
    </div>
  );
};

export default PropFirmAccountDetailsStep;
