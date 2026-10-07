class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function fail(status, message) {
  throw new HttpError(status, message);
}
function text(value, name, max, required = true) {
  if (value == null && !required) return '';
  if (typeof value !== 'string') fail(400, `${name} must be text.`);
  const result = value.trim();
  if (required && !result) fail(400, `${name} is required.`);
  if (result.length > max) fail(400, `${name} must be ${max} characters or fewer.`);
  return result;
}
function id(value, name = 'record') {
  if (value === '' || value == null || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    fail(400, `Select a valid ${name}.`);
  }
  return Number(value);
}
function money(value, name, positive = false) {
  if (value === '' || value == null || !['string', 'number'].includes(typeof value))
    fail(400, `${name} is required.`);
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (positive && number <= 0) || number > 99999999.99) {
    fail(400, `${name} must be a valid ${positive ? 'positive' : 'non-negative'} amount.`);
  }
  if (Math.abs(number * 100 - Math.round(number * 100)) > 0.00001)
    fail(400, `${name} may have at most two decimal places.`);
  return Math.round(number * 100) / 100;
}
function date(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail(400, `${name} must be a valid date.`);
  const parsed = new Date(value + 'T00:00:00Z');
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value ||
    value < '1000-01-01'
  ) {
    fail(400, `${name} must be a valid date.`);
  }
  return value;
}
function email(value) {
  const result = text(value, 'Email', 100).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail(400, 'Enter a valid email address.');
  return result;
}
function password(value) {
  if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value, 'utf8') > 72) {
    fail(400, 'Use a password with at least 8 characters and no more than 72 bytes.');
  }
  return value;
}
function choice(value, choices, name) {
  if (!choices.includes(value)) fail(400, `Invalid ${name}.`);
  return value;
}
function receipt(value) {
  const result = text(value, 'Receipt URL', 500, false);
  if (!result) return '';
  try {
    if (!['http:', 'https:'].includes(new URL(result).protocol)) throw new Error();
  } catch {
    fail(400, 'Receipt URL must be a valid http or https address.');
  }
  return result;
}
module.exports = { HttpError, fail, text, id, money, date, email, password, choice, receipt };
