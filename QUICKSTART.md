# Quick Start Guide

Get your tailor shop app running in 5 minutes!

## Step 1: Install Dependencies

```bash
cd tailor-shop
npm install
```

## Step 2: Setup Database

```bash
yarn run prisma:generate
yarn run prisma:push
yarn run prisma:seed

```

## Step 3: Start the App

```bash
npm run dev
```

## Step 4: Open in Browser

Visit: **http://localhost:3003**

## What You'll See

- **Dashboard**: Overview of active orders, balances, and upcoming due dates
- **Orders**: 7 sample orders in different states (overdue, due today, due in 3 days, etc.)
- **Customers**: 3 sample customers with their order history
- **Payments**: Weekly payment reports and history

## Try These Actions

1. **Create a New Order**:
   - Click "Orders" → "+ New Order"
   - Select an existing customer or create new
   - Fill in order details and optional deposit

2. **Record a Payment**:
   - Open any order with outstanding balance
   - Click "+ Add Payment"
   - Enter amount and payment method

3. **View Weekly Report**:
   - Click "Payments"
   - Toggle between "This Week", "Last Week", or custom range
   - See breakdown by day and payment method

4. **See Color Coding**:
   - Dashboard shows color-coded urgency
   - Red = Overdue
   - Orange = 3 days or less
   - Yellow = 5 days or less
   - Gray = Safe

## Sample Login Info

No authentication required! The app is ready to use immediately.

## Need Help?

See [README.md](README.md) for full documentation.

---

Happy tailoring! ✂️
