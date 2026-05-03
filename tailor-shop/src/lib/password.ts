import { ValidationError } from './errors';

const PASSWORD_RULES = [
  { test: (value: string) => value.length >= 8, message: 'at least 8 characters' },
  { test: (value: string) => /[A-Z]/.test(value), message: 'one uppercase letter' },
  { test: (value: string) => /[a-z]/.test(value), message: 'one lowercase letter' },
  { test: (value: string) => /\d/.test(value), message: 'one number' },
  { test: (value: string) => /[^A-Za-z0-9]/.test(value), message: 'one symbol' },
];

export function validatePasswordStrength(password: string) {
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.message);

  if (missing.length > 0) {
    throw new ValidationError(`Password must include ${missing.join(', ')}`);
  }
}
