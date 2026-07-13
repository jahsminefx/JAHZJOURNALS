import React from 'react';
import { useFormContext } from 'react-hook-form';
import DrawdownTypeSelect from './DrawdownTypeSelect';
import PhaseRuleCard from './PhaseRuleCard';
import { PercentageInput, SelectInput } from './FormControls';

const fundedEvaluationTypes = new Set(['INSTANT_FUNDED', 'ALREADY_FUNDED']);

const PropFirmChallengeRulesStep = ({ onPhaseCountChange }) => {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext();

  const evaluationType = watch('evaluationType');
  const phaseCount = Number(watch('phaseCount') || 0);
  const accountSize = watch('accountSize');
  const currency = watch('currency');
  const phases = watch('phases') || [];
  const isFunded = fundedEvaluationTypes.has(evaluationType);

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Challenge rules</h3>
          <p className="mt-1 text-sm text-muted">Capture the rules that drive progress tracking. Everything deeper can be edited later.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <SelectInput
            label="Number of phases"
            error={errors.phaseCount?.message || errors.phases?.message}
            value={phaseCount}
            onChange={(event) => onPhaseCountChange(Number(event.target.value))}
          >
            <option value="1">One phase</option>
            <option value="2">Two phases</option>
            <option value="3">Three phases</option>
            <option value="0">No evaluation phase</option>
          </SelectInput>
          <PercentageInput label="Maximum daily loss percentage" error={errors.dailyLossPercent?.message} {...register('dailyLossPercent')} />
          <PercentageInput label="Maximum overall loss percentage" error={errors.maximumLossPercent?.message} {...register('maximumLossPercent')} />
          <DrawdownTypeSelect error={errors.drawdownType?.message} {...register('drawdownType')} />
        </div>
      </section>

      {isFunded || phaseCount === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-5 text-sm leading-6 text-muted">
          This account skips evaluation phases. You can still add funded payout settings from Advanced Settings after creation.
        </div>
      ) : (
        <section className="space-y-4">
          {phases.map((phase, index) => (
            <PhaseRuleCard
              key={`${phase.name}-${index}`}
              index={index}
              accountSize={accountSize}
              currency={currency}
              register={register}
              watch={watch}
              errors={errors.phases?.[index]}
            />
          ))}
        </section>
      )}
    </div>
  );
};

export default PropFirmChallengeRulesStep;
