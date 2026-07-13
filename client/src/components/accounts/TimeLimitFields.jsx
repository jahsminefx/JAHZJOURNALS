import React from 'react';
import { SelectInput, TextInput } from './FormControls';

const TimeLimitFields = ({ baseName, register, watch, errors = {} }) => {
  const timeLimitType = watch(`${baseName}.timeLimitType`);

  return (
    <>
      <SelectInput label="Time limit" error={errors.timeLimitType?.message} {...register(`${baseName}.timeLimitType`)}>
        <option value="UNLIMITED">Unlimited</option>
        <option value="CALENDAR_DAYS">Calendar days</option>
        <option value="TRADING_DAYS">Trading days</option>
      </SelectInput>
      {timeLimitType !== 'UNLIMITED' && (
        <TextInput
          type="number"
          min="1"
          label="Time-limit days"
          error={errors.timeLimitDays?.message}
          {...register(`${baseName}.timeLimitDays`)}
        />
      )}
    </>
  );
};

export default TimeLimitFields;
