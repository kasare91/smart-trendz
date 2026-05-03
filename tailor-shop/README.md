# Tailor Desk

A configurable boutique and tailor shop management system for customer orders, payments, balances, reminders, reports, and business branding. Built with Next.js, TypeScript, Prisma, and Tailwind CSS.

## Features

### Core Functionality
- **Customer Management**: Track customer information and order history
- **Order Management**: Create, edit, and track orders with detailed descriptions
- **Payment Tracking**: Record full and partial payments with multiple payment methods
- **Outstanding Balances**: View balances per customer and per order
- **Weekly Reports**: Filter and view cash received by week with breakdown by day and payment method
- **Due Date Reminders**: Color-coded urgency system (5, 3, 1 day warnings + overdue)

### Advanced Features
- **Email/SMS Notifications**: Automated reminders for orders due soon (via SendGrid, SMTP, and Twilio)
- **User Authentication**: Secure login with role-based access control (Admin, Staff, Viewer)
- **Analytics Dashboard**: Business insights with interactive charts and reports
  - Monthly revenue trends
  - Customer lifetime value analysis
  - Popular items tracking
  - Payment method distribution
  - Order status distribution

### Dashboard
- Active orders count
- Total outstanding balance across all orders
- Total received this week
- Upcoming orders section with color-coded urgency

### Technical Features
- Server-side rendering for fast page loads
- RESTful API architecture
- Responsive design (mobile & desktop)
- Easy database switching (SQLite ↔ PostgreSQL)
- Type-safe database queries with Prisma
- Configurable business profile, logo, receipt footer, currency, and invoice prefix
- Automatic order numbering with the configured invoice prefix, for example `ORD-2026-0001`

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: SQLite (development) / PostgreSQL (production)
- **ORM**: Prisma
- **Styling**: Tailwind CSS
- **Authentication**: NextAuth.js
- **Charts**: Recharts
- **Notifications**: SendGrid, Nodemailer, Twilio
- **Date Handling**: date-fns

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Git (optional, for version control)

## Installation & Setup

### 1. Install Dependencies

```bash
cd tailor-shop
npm install --legacy-peer-deps
```

**Note**: Use `--legacy-peer-deps` flag due to peer dependency conflicts between NextAuth and Nodemailer versions.

### 2. Set Up the Database

Generate Prisma client and push the schema to the database:

```bash
npm run prisma:generate
npm run prisma:push
```

This will create a SQLite database file at `prisma/dev.db`.

For production databases, apply committed Prisma migrations instead of pushing:

```bash
npx prisma migrate deploy
npm run prisma:generate
```

### 3. Configure Environment Variables

The application requires environment variables for authentication and optional notifications. Update `.env`:

```env
# Required for Authentication
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret-key-change-in-production

# Optional: Email Notifications (choose SendGrid OR SMTP)
ENABLE_EMAIL_NOTIFICATIONS=false
# SENDGRID_API_KEY=your_sendgrid_key
# FROM_EMAIL=noreply@example.com

# OR use SMTP (e.g., Gmail)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password

# Optional: SMS Notifications
ENABLE_SMS_NOTIFICATIONS=false
# TWILIO_ACCOUNT_SID=your_twilio_sid
# TWILIO_AUTH_TOKEN=your_twilio_token
# TWILIO_PHONE_NUMBER=+1234567890

# Cron Job Security
CRON_SECRET=dev-secret-change-in-production

# Supabase Storage for image uploads
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=order-images
```

**Generate a secure NEXTAUTH_SECRET**:
```bash
openssl rand -base64 32
```

### 4. Seed the Database

Populate the database with sample data:

```bash
npm run prisma:seed
```

This creates:
- 1 sample business profile (`Demo Boutique`)
- 3 demo users (see below)
- 3 customers
- 7 orders with various statuses and due dates
- Multiple payments demonstrating all urgency states

**Demo Users**:
- Admin: `admin@example.com` / `admin123`
- Staff: `accra@example.com` / `staff123`
- Staff: `koforidua@example.com` / `staff123`

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

**First Time Setup**: If no business profile exists, the app redirects to `/setup`. Enter the boutique name, contact details, currency, invoice prefix, optional logo, and receipt footer. After setup, sign in with an admin account and use `/settings` to edit the profile later.

### Business Profile Setup

The business profile controls the app branding and printed order summary details:

- Business name and type
- Owner and contact details
- Address, city, and country
- Currency
- Logo stored through Supabase Storage when configured
- Optional brand color
- Receipt footer note
- Invoice/order prefix

For a new production installation, run migrations, start the app, and complete `/setup` before daily use.

## Sample Data

The seed script creates orders in different states to demonstrate all features:

- **Overdue**: 1 order (2 days past due, partial payment)
- **Due Today**: 1 order (outstanding balance)
- **Due Tomorrow**: 1 order (fully paid)
- **Due in 3 Days**: 1 order (partial payment)
- **Due in 5 Days**: 1 order (fully paid)
- **Safe (10 days)**: 1 order (partial payment)
- **Collected**: 1 order (completed)

## Project Structure

```
tailor-shop/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Sample data
├── src/
│   ├── app/
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # NextAuth endpoints
│   │   │   ├── customers/     # Customer CRUD
│   │   │   ├── orders/        # Order CRUD
│   │   │   ├── payments/      # Payment recording
│   │   │   ├── reports/       # Dashboard & weekly reports
│   │   │   ├── analytics/     # Business analytics
│   │   │   └── notifications/ # Email/SMS notifications
│   │   ├── customers/         # Customer pages
│   │   ├── orders/            # Order pages
│   │   ├── payments/          # Payment reports page
│   │   ├── analytics/         # Analytics dashboard
│   │   ├── login/             # Login page
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Dashboard
│   │   └── globals.css        # Global styles
│   ├── components/
│   │   ├── Navigation.tsx     # Main navigation
│   │   └── SessionProvider.tsx # NextAuth provider
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client
│   │   ├── utils.ts           # Utility functions
│   │   ├── auth.ts            # Authentication helpers
│   │   └── notifications.ts   # Email/SMS service
│   ├── types/
│   │   └── next-auth.d.ts     # NextAuth types
│   └── middleware.ts          # Route protection
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

## Usage Guide

### Creating a New Order

1. Navigate to **Orders** → **+ New Order**
2. Choose an existing customer or create a new one
3. Enter order details:
   - Description (e.g., "Kente dress + blazer")
   - Total amount
   - Order date and due date
   - Status
4. Optionally add an initial deposit
5. Click **Create Order**

### Recording a Payment

1. Go to an order detail page
2. Click **+ Add Payment**
3. Enter payment details:
   - Amount (validated against outstanding balance)
   - Payment method (Cash, Mobile Money, Card, Other)
   - Payment date
   - Optional note
4. Click **Add Payment**

### Viewing Weekly Reports

1. Navigate to **Payments**
2. Select a date range:
   - This Week
   - Last Week
   - Custom Range
3. View:
   - Total received
   - Breakdown by payment method
   - Daily breakdown (Mon-Sun)

## Production Notes

### Supabase Storage

New image uploads are stored in Supabase Storage through the server-side `/api/uploads/images` route. Create a bucket matching `SUPABASE_STORAGE_BUCKET`, configure the bucket/public URL policy you want for image reads, and keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Existing base64 image values remain displayable because the app still accepts data URLs from older records.

### Reminder Cron Dedupe

Reminder sends are recorded in `OrderNotificationLog` with a unique key on `orderId`, `reminderType`, and `windowDate`. The cron supports the 5-day, 3-day, 1-day, and overdue windows and is idempotent for repeated runs.

### Rate Limiting

Sensitive API routes use the in-memory limiter in `src/lib/rate-limit.ts`. This is practical for local development and single-instance deployments. For production with multiple instances, replace the map-backed storage with Redis or Upstash so limits are shared across instances.

### Password Reset Email

Forgot-password requests store only a hashed reset token and return a generic response whether or not an account exists. In development without email enabled, the reset link is logged to the server console. In production, configure SendGrid or SMTP with `ENABLE_EMAIL_NOTIFICATIONS=true`, `FROM_EMAIL`, and the relevant provider credentials.
   - Full payment list

### Understanding Due Date Colors

The system uses color-coding to highlight order urgency:

- **Gray**: More than 5 days until due (safe)
- **Yellow**: 5 days or less until due (warning)
- **Orange**: 3 days or less until due (urgent)
- **Red**: 1 day or less / overdue (critical)

## Database Schema

### Customer
- `id`, `fullName`, `phoneNumber`, `email`, `createdAt`

### Order
- `id`, `orderNumber`, `customerId`, `description`, `totalAmount`
- `status`: String (PENDING, IN_PROGRESS, READY, COLLECTED, CANCELLED)
- `orderDate`, `dueDate`, `createdAt`, `updatedAt`

### Payment
- `id`, `orderId`, `amount`, `paymentDate`
- `paymentMethod`: String (CASH, MOMO, CARD, OTHER)
- `note`, `createdAt`

### User
- `id`, `email`, `name`, `password` (bcrypt hashed)
- `role`: String (ADMIN, STAFF, VIEWER)
- `createdAt`, `updatedAt`

**Note**: Status, payment method, and role fields use String type for SQLite compatibility. When using PostgreSQL, you can optionally convert these to proper enums for better type safety.

## Switching to PostgreSQL

To use PostgreSQL instead of SQLite:

1. Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

# Optional: Convert to enums for better type safety
model Order {
  # ... other fields
  status OrderStatus @default(PENDING)
  # ...
}

model Payment {
  # ... other fields
  paymentMethod PaymentMethod @default(CASH)
  # ...
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

2. Update `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/tailor_shop?schema=public"
```

3. Run migrations:
```bash
npm run prisma:push
npm run prisma:seed
```

## API Endpoints

### Authentication
- `POST /api/auth/[...nextauth]` - NextAuth endpoints (signin, signout, session)

### Customers
- `GET /api/customers` - List customers (with search)
- `POST /api/customers` - Create customer
- `GET /api/customers/[id]` - Get customer details
- `PATCH /api/customers/[id]` - Update customer
- `DELETE /api/customers/[id]` - Delete customer

### Orders
- `GET /api/orders` - List orders (with filters)
- `POST /api/orders` - Create order
- `GET /api/orders/[id]` - Get order details
- `PATCH /api/orders/[id]` - Update order
- `DELETE /api/orders/[id]` - Delete order

### Payments
- `GET /api/payments` - List payments (with date filter)
- `POST /api/payments` - Create payment

### Reports
- `GET /api/reports/dashboard` - Dashboard statistics
- `GET /api/reports/weekly-payments` - Weekly payment report

### Analytics
- `GET /api/analytics` - Business analytics and insights

### Notifications
- `POST /api/notifications/send` - Send notification for a specific order
- `GET /api/notifications/cron` - Cron job for daily notifications (protected)

## Development Commands

```bash
# Development
npm run dev              # Start dev server

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:push      # Push schema to database
npm run prisma:studio    # Open Prisma Studio GUI
npm run prisma:seed      # Seed database

# Production
npm run build            # Build for production
npm start                # Start production server
```

## Advanced Features

### Email/SMS Notifications

Automated reminders for orders approaching their due date.

**Setup Email Notifications**:

Option 1 - SendGrid (Recommended for production):
```env
ENABLE_EMAIL_NOTIFICATIONS=true
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=noreply@example.com
```

Option 2 - SMTP (Good for development):
```env
ENABLE_EMAIL_NOTIFICATIONS=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=your-email@gmail.com
```

**Setup SMS Notifications**:
```env
ENABLE_SMS_NOTIFICATIONS=true
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

**Manual Notification** (send to specific order):
```bash
POST /api/notifications/send
Body: { "orderId": "order-id-here" }
```

**Automated Daily Cron Job**:
Set up on Vercel by adding to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/notifications/cron",
    "schedule": "0 9 * * *"
  }]
}
```

Or call manually:
```bash
GET /api/notifications/cron?secret=YOUR_CRON_SECRET
```

### User Authentication & Roles

Three user roles with different access levels:

- **ADMIN**: Full access (create, read, update, delete)
- **STAFF**: Standard access (create, read, update)
- **VIEWER**: Read-only access

All routes except `/login` are protected by authentication middleware.

### Analytics Dashboard

Access via the Analytics page for business insights:

- **Monthly Revenue**: Last 6 months trend line chart
- **Customer Lifetime Value**: Top 10 customers by total spending
- **Popular Items**: Most frequently ordered items with revenue
- **Payment Methods**: Distribution pie chart
- **Order Status**: Distribution bar chart

## Potential Future Enhancements

1. **Inventory Management**:
   - Track fabric and materials
   - Link to orders
   - Low stock alerts

2. **Photo Uploads**:
   - Customer measurements
   - Design references
   - Completed work gallery
   - Use UploadThing or similar service

3. **Export Features**:
   - Export reports to PDF/Excel
   - Print invoices and receipts

4. **Advanced Permissions**:
   - Fine-grained role permissions
   - Per-user activity logging
   - Audit trails

## Troubleshooting

### Database Issues

If you encounter database errors:

```bash
# Reset database
rm prisma/dev.db
npm run prisma:push
npm run prisma:seed
```

### Port Already in Use

If port 3000 is occupied:

```bash
# Use a different port
PORT=3001 npm run dev
```

### TypeScript Errors

```bash
# Regenerate Prisma client
npm run prisma:generate
```

## License

MIT License - Feel free to use this project for your tailor shop!

## Support

For issues or questions, please open an issue on the repository.

---

Built with ❤️ for tailor shop owners
