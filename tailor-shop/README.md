# Smart Trendz Management System

A complete, production-ready web application for managing Smart Trendz customer orders and payments. Built with Next.js, TypeScript, Prisma, and Tailwind CSS.

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
- Automatic order numbering (T-YYYY-####)

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

### 3. Configure Environment Variables

The application requires environment variables for authentication and optional notifications. Update `.env`:

```env
# Required for Authentication
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-secret-key-change-in-production

# Optional: Email Notifications (choose SendGrid OR SMTP)
ENABLE_EMAIL_NOTIFICATIONS=false
# SENDGRID_API_KEY=your_sendgrid_key
# FROM_EMAIL=noreply@smarttrendz.com

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
- 3 demo users (see below)
- 3 customers
- 7 orders with various statuses and due dates
- Multiple payments demonstrating all urgency states

**Demo Users**:
- Admin: `admin@smarttrendz.com` / `admin123`
- Staff: `staff@smarttrendz.com` / `staff123`
- Viewer: `viewer@smarttrendz.com` / `viewer123`

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

**First Time Setup**: You'll be redirected to the login page. Use one of the demo user credentials above to sign in.

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
FROM_EMAIL=noreply@smarttrendz.com
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
