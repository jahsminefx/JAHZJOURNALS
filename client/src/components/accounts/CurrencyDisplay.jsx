import React from 'react';

const CurrencyDisplay = ({ value, currency = 'USD' }) => {
  const number = Number(value || 0);

  return (
    <span>
      {number.toLocaleString(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      })}
    </span>
  );
};

export default CurrencyDisplay;
