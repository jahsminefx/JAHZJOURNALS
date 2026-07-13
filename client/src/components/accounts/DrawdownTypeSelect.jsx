import React from 'react';
import { SelectInput } from './FormControls';

const DrawdownTypeSelect = ({ error, ...props }) => (
  <SelectInput label="Drawdown type" error={error} {...props}>
    <option value="STATIC">Static</option>
    <option value="TRAILING">Trailing</option>
    <option value="END_OF_DAY_TRAILING">End-of-day trailing</option>
    <option value="INTRADAY_TRAILING">Intraday trailing</option>
  </SelectInput>
);

export default DrawdownTypeSelect;
