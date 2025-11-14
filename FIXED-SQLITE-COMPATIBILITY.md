# SQLite Compatibility Fix

## Issue Fixed

The original schema used PostgreSQL `enum` types which are not supported by SQLite.

## Changes Made

### Before (PostgreSQL enums)
```prisma
model Order {
  status OrderStatus @default(PENDING)
}

model Payment {
  paymentMethod PaymentMethod @default(CASH)
}

enum OrderStatus {
  PENDING
  IN_PROGRESS
  READY
  COLLECTED
  CANCELLED
}

enum PaymentMethod {
  CASH
  MOMO
  CARD
  OTHER
}
```

### After (SQLite-compatible strings)
```prisma
model Order {
  status String @default("PENDING") // PENDING, IN_PROGRESS, READY, COLLECTED, CANCELLED
}

model Payment {
  paymentMethod String @default("CASH") // CASH, MOMO, CARD, OTHER
}
```

## Benefits

✅ **Works with SQLite** - No enum support needed
✅ **Works with PostgreSQL** - Strings are universally supported
✅ **Easy to migrate** - Can convert to proper enums later if needed
✅ **Type-safe in TypeScript** - Application code still validates values

## Application Code

The application code already handles these as strings correctly:
- Form dropdowns use string values
- API routes accept/validate string values
- TypeScript types in components use string literals

## Optional: Convert to PostgreSQL Enums Later

If you migrate to PostgreSQL and want proper enum types:

1. Update schema to use enums (see README.md)
2. Run `npx prisma db push`
3. Data will be automatically migrated (strings → enums)

## No Code Changes Needed

The application code works with both approaches since it treats these as strings throughout.
