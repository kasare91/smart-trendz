import { differenceInCalendarDays } from 'date-fns';

export type ReminderType = 'DUE_5_DAYS' | 'DUE_3_DAYS' | 'DUE_1_DAY' | 'OVERDUE';

export function getReminderType(dueDate: Date, now = new Date()): ReminderType | null {
  const today = startOfDay(now);
  const due = startOfDay(dueDate);
  const days = differenceInCalendarDays(due, today);

  if (days === 5) return 'DUE_5_DAYS';
  if (days === 3) return 'DUE_3_DAYS';
  if (days === 1) return 'DUE_1_DAY';
  if (days < 0) return 'OVERDUE';

  return null;
}

export function getReminderWindowDate(dueDate: Date) {
  return startOfDay(dueDate);
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}
