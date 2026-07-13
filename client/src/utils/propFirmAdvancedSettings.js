const fundedEvaluationTypes = new Set(['INSTANT_FUNDED', 'ALREADY_FUNDED']);

export const shouldShowFundedSettings = ({ evaluationType, accountStatus }) => (
  fundedEvaluationTypes.has(evaluationType) || accountStatus === 'FUNDED'
);
