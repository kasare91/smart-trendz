import { differenceInDays, startOfWeek, endOfWeek, format } from 'date-fns';
import { Order, Payment, Customer } from '@prisma/client';

export type OrderWithPayments = Order & {
  payments: Payment[];
};

export type OrderWithRelations = Order & {
  payments: Payment[];
  customer: Customer;
};

export type DueDateUrgency = 'safe' | 'warning-5' | 'warning-3' | 'warning-1' | 'overdue';

/**
 * Calculate the total amount paid for an order
 */
export function calculateAmountPaid(payments: Payment[]): number {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

/**
 * Calculate the outstanding balance for an order
 */
export function calculateBalance(totalAmount: number, amountPaid: number): number {
  return totalAmount - amountPaid;
}

/**
 * Calculate days remaining until due date
 * Positive = days remaining, Negative = days overdue
 */
export function calculateDaysToDue(dueDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return differenceInDays(due, today);
}

/**
 * Determine urgency level based on days to due date
 */
export function getDueDateUrgency(dueDate: Date): DueDateUrgency {
  const days = calculateDaysToDue(dueDate);

  if (days <= 0) return 'overdue';
  if (days <= 1) return 'warning-1';
  if (days <= 3) return 'warning-3';
  if (days <= 5) return 'warning-5';
  return 'safe';
}

/**
 * Get urgency color classes for Tailwind
 */
export function getUrgencyColor(urgency: DueDateUrgency): {
  bg: string;
  text: string;
  border: string;
} {
  switch (urgency) {
    case 'overdue':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-400',
      };
    case 'warning-1':
      return {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-300',
      };
    case 'warning-3':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-300',
      };
    case 'warning-5':
      return {
        bg: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-300',
      };
    default:
      return {
        bg: 'bg-slate-50',
        text: 'text-slate-700',
        border: 'border-slate-200',
      };
  }
}

/**
 * Get urgency badge text
 */
export function getUrgencyLabel(urgency: DueDateUrgency, days: number): string {
  if (urgency === 'overdue') {
    return days === 0 ? 'Due Today' : `${Math.abs(days)} days overdue`;
  }
  if (days === 1) return 'Due Tomorrow';
  return `${days} days left`;
}

/**
 * Format currency (GHS - Ghana Cedis)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
  }).format(amount);
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  return format(new Date(date), 'MMM dd, yyyy');
}

/**
 * Format date and time
 */
export function formatDateTime(date: Date | string): string {
  return format(new Date(date), 'MMM dd, yyyy HH:mm');
}

/**
 * Get start and end of current week (Monday-Sunday)
 */
export function getCurrentWeek(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 }),
  };
}

/**
 * Get start and end of last week
 */
export function getLastWeek(): { start: Date; end: Date } {
  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    start: startOfWeek(lastWeek, { weekStartsOn: 1 }),
    end: endOfWeek(lastWeek, { weekStartsOn: 1 }),
  };
}

/**
 * Generate next order number (format: T-YYYY-####)
 */
export function generateOrderNumber(lastOrderNumber: string | null): string {
  const year = new Date().getFullYear();
  const prefix = `T-${year}-`;

  if (!lastOrderNumber || !lastOrderNumber.startsWith(prefix)) {
    return `${prefix}0001`;
  }

  const lastNumber = parseInt(lastOrderNumber.split('-')[2]);
  const nextNumber = (lastNumber + 1).toString().padStart(4, '0');
  return `${prefix}${nextNumber}`;
}

/**
 * Enrich order with computed fields
 */
export function enrichOrder<T extends OrderWithPayments | OrderWithRelations>(order: T) {
  const amountPaid = calculateAmountPaid(order.payments);
  const balance = calculateBalance(order.totalAmount, amountPaid);
  const daysToDue = calculateDaysToDue(order.dueDate);
  const urgency = getDueDateUrgency(order.dueDate);

  return {
    ...order,
    amountPaid,
    balance,
    daysToDue,
    urgency,
  };
}
