import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import PropFirmStepIndicator from './PropFirmStepIndicator';
import PropFirmAccountDetailsStep from './PropFirmAccountDetailsStep';
import PropFirmChallengeRulesStep from './PropFirmChallengeRulesStep';
import PropFirmReviewStep from './PropFirmReviewStep';
import {
  buildPropFirmPayload,
  coerceExpectedPhaseCount,
  getSchemaForStep,
  getWizardStepSet,
  normalizePropFirmInitialValues,
  resizePhases,
  propFirmAccountDetailsSchema,
  propFirmChallengeRulesSchema,
} from '../../utils/propFirmWizard';

const focusFirstIssue = (setFocus, issues) => {
  const firstPath = issues[0]?.path?.join('.');
  if (firstPath) setFocus(firstPath);
};

const applyIssues = (setError, issues) => {
  issues.forEach((issue) => {
    const path = issue.path.join('.');
    if (path) {
      setError(path, { type: 'manual', message: issue.message });
    }
  });
};

const PropFirmAccountWizard = ({ initialValues, isSaving, mode = 'full', onSubmit, submitLabel = 'Add Evaluation Account' }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const stepSet = useMemo(() => getWizardStepSet(mode), [mode]);
  const steps = useMemo(() => stepSet.map((step) => step.label), [stepSet]);
  const currentStepKey = stepSet[currentStep]?.key || 'review';
  const methods = useForm({
    defaultValues: normalizePropFirmInitialValues(initialValues),
    mode: 'onChange',
  });
  const {
    clearErrors,
    control,
    getValues,
    handleSubmit,
    reset,
    setError,
    setFocus,
    setValue,
  } = methods;
  const watchedValues = useWatch({ control }) || getValues();
  const evaluationType = watchedValues.evaluationType;

  useEffect(() => {
    reset(normalizePropFirmInitialValues(initialValues));
  }, [initialValues, reset]);

  const setPhaseCount = useCallback((count) => {
    const nextCount = Number(count);
    const currentPhases = getValues('phases') || [];
    const phases = resizePhases(nextCount, currentPhases);

    setValue('phaseCount', nextCount, { shouldDirty: true, shouldValidate: true });
    setValue('phases', phases, { shouldDirty: true, shouldValidate: true });
  }, [getValues, setValue]);

  useEffect(() => {
    const expected = coerceExpectedPhaseCount(evaluationType, getValues('phaseCount'));
    if (Number(getValues('phaseCount')) !== expected) {
      setPhaseCount(expected);
    }
  }, [evaluationType, getValues, setPhaseCount]);

  const applyTemplate = (templateValues) => {
    if (!templateValues) return;

    Object.entries(templateValues).forEach(([key, value]) => {
      setValue(key, value, { shouldDirty: true, shouldValidate: true });
    });
  };

  const validateStep = (step) => {
    const stepKey = stepSet[step]?.key;
    const schema = getSchemaForStep(stepKey);
    if (!schema) return true;

    clearErrors();
    const result = schema.safeParse(getValues());
    if (result.success) return true;

    applyIssues(setError, result.error.issues);
    focusFirstIssue(setFocus, result.error.issues);
    return false;
  };

  const canContinue = useMemo(() => {
    const schema = getSchemaForStep(currentStepKey);
    return schema ? schema.safeParse(watchedValues).success : true;
  }, [currentStepKey, watchedValues]);

  const moveToStepKey = (stepKey) => {
    const nextIndex = stepSet.findIndex((step) => step.key === stepKey);
    setCurrentStep(nextIndex === -1 ? 0 : nextIndex);
  };

  const next = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  };

  const submit = (form) => {
    clearErrors();
    const details = propFirmAccountDetailsSchema.safeParse(form);
    const rules = propFirmChallengeRulesSchema.safeParse(form);

    if (!details.success) {
      moveToStepKey('details');
      applyIssues(setError, details.error.issues);
      focusFirstIssue(setFocus, details.error.issues);
      return;
    }

    if (!rules.success) {
      moveToStepKey('challenge');
      applyIssues(setError, rules.error.issues);
      focusFirstIssue(setFocus, rules.error.issues);
      return;
    }

    onSubmit(buildPropFirmPayload(form));
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(submit)} className="space-y-6">
        <PropFirmStepIndicator steps={steps} currentStep={currentStep} />

        <div className="rounded-xl border border-border bg-surface-muted p-5 sm:p-6">
          {currentStepKey === 'details' && <PropFirmAccountDetailsStep onApplyTemplate={applyTemplate} />}
          {currentStepKey === 'challenge' && <PropFirmChallengeRulesStep onPhaseCountChange={setPhaseCount} />}
          {currentStepKey === 'review' && <PropFirmReviewStep editableStepKeys={stepSet.map((step) => step.key)} onEditStep={moveToStepKey} />}

          <div className="mt-8 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep((step) => Math.max(step - 1, 0))}
              disabled={currentStep === 0 || isSaving}
              className="rounded-lg border border-gray-600 px-5 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Go Back
            </button>

            {currentStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={next}
                disabled={!canContinue || isSaving}
                className="rounded-lg bg-green-500 px-5 py-2.5 text-sm font-bold text-gray-900 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next Step
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-green-500 px-5 py-2.5 text-sm font-bold text-gray-900 transition hover:bg-green-400 disabled:opacity-70"
              >
                {isSaving ? 'Saving...' : submitLabel}
              </button>
            )}
          </div>
        </div>
      </form>
    </FormProvider>
  );
};

export default PropFirmAccountWizard;
