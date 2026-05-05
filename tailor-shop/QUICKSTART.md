# Quick Start Guide

Get your tailor shop app running in 5 minutes.

## Step 1: Install Dependencies

```bash
cd tailor-shop
yarn install
```

## Step 2: Set Up the Database

```bash
yarn prisma:generate
yarn prisma:push
yarn prisma:seed
```

This creates a SQLite dev database at `prisma/dev.db` with sample data.

## Step 3: Configure Environment Variables

Copy `.env.example` to `.env` and fill in at minimum:

```env
NEXTAUTH_URL=http://localhost:3003
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
```

## Step 4: Start the App

```bash
yarn dev
```

Open **http://localhost:3003** in your browser.

## Step 5: Log In

| Email | Password | Role |
|---|---|---|
| `admin@example.com` | `admin123` | Admin (all branches) |
| `accra@example.com` | `staff123` | Staff — Accra branch |
| `koforidua@example.com` | `staff123` | Staff — Koforidua branch |

## What You'll See

- **Dashboard**: Active orders, outstanding balance, weekly revenue, upcoming due dates
- **Orders**: 7 sample orders spanning all urgency states (overdue → safe)
- **Customers**: 3 sample customers with order history and measurements
- **Payments**: Weekly payment report with breakdown by day and payment method
- **Analytics**: Revenue trends, customer lifetime value, popular items
- **Activity Logs**: Audit trail of all mutations (admin view)

## Try These Actions

1. **Create a new order**: Orders → + New Order → pick existing customer or create inline
2. **Record a payment**: Open any order with outstanding balance → + Add Payment
3. **View weekly report**: Payments → toggle This Week / Last Week / custom range
4. **Switch theme**: Click the sun/moon icon at the bottom of the sidebar

## Colour Coding (Due Date Urgency)

| Colour | Meaning |
|---|---|
| Red | Overdue |
| Rose | Due today or tomorrow |
| Amber | Due in 2–3 days |
| Yellow | Due in 4–5 days |
| Gray | Safe (6+ days) |

## Need Help?

See [README.md](README.md) for full documentation.
