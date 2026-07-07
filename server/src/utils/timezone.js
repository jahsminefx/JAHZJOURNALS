const isValidTimeZone = (timezone) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch (error) {
    return false;
  }
};

const getTimeZoneOffsetMs = (date, timezone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return asUtc - date.getTime();
};

const zonedDateTimeToUtc = ({ year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0 }, timezone = 'UTC') => {
  const safeTimezone = isValidTimeZone(timezone) ? timezone : 'UTC';
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  const offsetMs = getTimeZoneOffsetMs(utcGuess, safeTimezone);
  return new Date(utcGuess.getTime() - offsetMs);
};

const parseLocalDate = (value) => {
  if (value instanceof Date) {
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    };
  }

  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
};

const getUtcWeekRange = (weekStartDate, timezone = 'UTC') => {
  const localDate = parseLocalDate(weekStartDate);
  if (!localDate) return null;

  const start = zonedDateTimeToUtc(localDate, timezone);
  const end = new Date(start.getTime() + (7 * 24 * 60 * 60 * 1000) - 1);

  return { start, end };
};

module.exports = {
  getUtcWeekRange,
  isValidTimeZone,
  zonedDateTimeToUtc,
};
