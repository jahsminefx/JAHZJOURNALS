/**
 * Broker Presets & Validation Architecture for JAHZJOURNALS Risk Calculator V2
 * Supports STANDARD, BROKER presets, and CUSTOM trader specifications.
 */
import { SPECIFICATION_SOURCES } from './instrumentSpecs.js';

export const BROKER_PRESETS = {
  STANDARD: {
    id: 'STANDARD',
    name: 'JAHZJOURNALS Standard Specifications',
    source: SPECIFICATION_SOURCES.STANDARD,
    description: 'Generic institutional default specs (EURUSD 100k, Gold 100oz, NAS100 $1/point).',
  },
  // Extensible for future broker presets (e.g. FTMO, IC Markets, OANDA) when explicitly configured.
};

/**
 * Validates a custom broker specification input object.
 * Guarantees no zero, negative, NaN, Infinity, or invalid lot ranges.
 */
export const validateCustomBrokerSpec = (spec) => {
  const errors = [];

  const contractSize = Number(spec.contractSize);
  const tickSize = Number(spec.tickSize);
  const tickValue = Number(spec.tickValue);
  const lotStep = Number(spec.lotStep);
  const minLot = Number(spec.minLot);
  const maxLot = Number(spec.maxLot);
  const pricePrecision = spec.pricePrecision !== undefined && spec.pricePrecision !== null && spec.pricePrecision !== '' ? Number(spec.pricePrecision) : 5;

  if (!contractSize || Number.isNaN(contractSize) || !Number.isFinite(contractSize) || contractSize <= 0) {
    errors.push('Contract Size must be a positive number greater than 0.');
  }

  if (!tickSize || Number.isNaN(tickSize) || !Number.isFinite(tickSize) || tickSize <= 0) {
    errors.push('Tick Size must be a positive number greater than 0.');
  }

  if (spec.tickValue !== undefined && spec.tickValue !== null && spec.tickValue !== '') {
    if (Number.isNaN(tickValue) || !Number.isFinite(tickValue) || tickValue <= 0) {
      errors.push('Tick Value must be a positive number greater than 0.');
    }
  }

  if (!lotStep || Number.isNaN(lotStep) || !Number.isFinite(lotStep) || lotStep <= 0) {
    errors.push('Lot Step must be a positive number greater than 0 (e.g. 0.01).');
  }

  if (!minLot || Number.isNaN(minLot) || !Number.isFinite(minLot) || minLot <= 0) {
    errors.push('Minimum Lot must be a positive number greater than 0 (e.g. 0.01).');
  }

  if (!maxLot || Number.isNaN(maxLot) || !Number.isFinite(maxLot) || maxLot <= 0) {
    errors.push('Maximum Lot must be a positive number greater than 0 (e.g. 100).');
  }

  if (minLot > maxLot) {
    errors.push(`Minimum Lot (${minLot}) cannot exceed Maximum Lot (${maxLot}).`);
  }

  if (lotStep > maxLot) {
    errors.push(`Lot Step (${lotStep}) cannot exceed Maximum Lot (${maxLot}).`);
  }

  if (Number.isNaN(pricePrecision) || pricePrecision < 0 || pricePrecision > 8) {
    errors.push('Price Precision must be an integer between 0 and 8.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
