# Future Enhancements Implementation Guide

A roadmap for extending Smart Trendz with advanced features.

## 1. Email/SMS Notifications 📧📱

### Overview
Automated reminders for upcoming order due dates using the existing urgency calculation logic.

### Prerequisites
```bash
npm install nodemailer twilio node-cron
npm install --save-dev @types/nodemailer @types/node-cron
```

### Implementation Steps

#### A. Environment Variables
Add to `.env`:
```env
# Twilio (for SMS)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# SendGrid (for Email)
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=noreply@smarttrendz.com

# Notification settings
ENABLE_SMS_NOTIFICATIONS=true
ENABLE_EMAIL_NOTIFICATIONS=true
```

#### B. Create Notification Service
Create `src/lib/notifications.ts`:
```typescript
import twilio from 'twilio';
import sgMail from '@sendgrid/mail';
import { getDueDateUrgency, calculateDaysToDue } from './utils';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendSMSReminder(
  phoneNumber: string,
  orderNumber: string,
  dueDate: Date,
  customerName: string
) {
  const days = calculateDaysToDue(dueDate);
  const urgency = getDueDateUrgency(dueDate);

  let message = '';
  if (urgency === 'overdue') {
    message = `Hi ${customerName}, your order ${orderNumber} is OVERDUE. Please collect it from Smart Trendz.`;
  } else if (urgency === 'warning-1') {
    message = `Hi ${customerName}, reminder: Order ${orderNumber} is due TOMORROW at Smart Trendz.`;
  } else if (urgency === 'warning-3') {
    message = `Hi ${customerName}, your order ${orderNumber} will be ready in ${days} days. Smart Trendz.`;
  } else if (urgency === 'warning-5') {
    message = `Hi ${customerName}, reminder: Order ${orderNumber} is due in ${days} days. Smart Trendz.`;
  }

  if (process.env.ENABLE_SMS_NOTIFICATIONS === 'true') {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });
  }
}

export async function sendEmailReminder(
  email: string,
  orderNumber: string,
  dueDate: Date,
  customerName: string,
  orderDescription: string,
  balance: number
) {
  const days = calculateDaysToDue(dueDate);
  const urgency = getDueDateUrgency(dueDate);

  let subject = '';
  let html = '';

  if (urgency === 'overdue') {
    subject = `⚠️ Order ${orderNumber} is Overdue`;
    html = `
      <h2>Order Overdue</h2>
      <p>Dear ${customerName},</p>
      <p>Your order <strong>${orderNumber}</strong> is now overdue.</p>
      <p><strong>Description:</strong> ${orderDescription}</p>
      <p><strong>Outstanding Balance:</strong> GHS ${balance.toFixed(2)}</p>
      <p>Please visit Smart Trendz to collect your order.</p>
    `;
  } else {
    subject = `Reminder: Order ${orderNumber} Due in ${days} Days`;
    html = `
      <h2>Order Reminder</h2>
      <p>Dear ${customerName},</p>
      <p>Your order <strong>${orderNumber}</strong> will be due in ${days} day(s).</p>
      <p><strong>Description:</strong> ${orderDescription}</p>
      <p><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
      <p><strong>Outstanding Balance:</strong> GHS ${balance.toFixed(2)}</p>
    `;
  }

  if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true') {
    await sgMail.send({
      to: email,
      from: process.env.FROM_EMAIL!,
      subject,
      html,
    });
  }
}
```

#### C. Create Cron Job
Create `src/lib/cron-jobs.ts`:
```typescript
import cron from 'node-cron';
import { prisma } from './prisma';
import { getDueDateUrgency, calculateDaysToDue } from './utils';
import { sendSMSReminder, sendEmailReminder } from './notifications';

export function startNotificationCron() {
  // Run every day at 9 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('Running daily notification check...');

    const orders = await prisma.order.findMany({
      where: {
        status: {
          notIn: ['COLLECTED', 'CANCELLED'],
        },
      },
      include: {
        customer: true,
        payments: true,
      },
    });

    for (const order of orders) {
      const days = calculateDaysToDue(order.dueDate);
      const urgency = getDueDateUrgency(order.dueDate);

      // Send notifications at 5, 3, 1 day thresholds and overdue
      if (urgency !== 'safe') {
        const amountPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
        const balance = order.totalAmount - amountPaid;

        // Send SMS
        if (order.customer.phoneNumber) {
          await sendSMSReminder(
            order.customer.phoneNumber,
            order.orderNumber,
            order.dueDate,
            order.customer.fullName
          );
        }

        // Send Email
        if (order.customer.email) {
          await sendEmailReminder(
            order.customer.email,
            order.orderNumber,
            order.dueDate,
            order.customer.fullName,
            order.description,
            balance
          );
        }
      }
    }

    console.log('Notification check complete.');
  });
}
```

#### D. Start Cron in Production
Update `src/app/api/cron/route.ts` (for Vercel Cron):
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSMSReminder, sendEmailReminder } from '@/lib/notifications';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Run notification logic here
  // (same as cron-jobs.ts but as an API endpoint)

  return NextResponse.json({ success: true });
}
```

---

## 2. Multi-User Authentication 👥

### Prerequisites
```bash
npm install next-auth @auth/prisma-adapter bcryptjs
npm install --save-dev @types/bcryptjs
```

### Implementation Steps

#### A. Update Prisma Schema
Add to `prisma/schema.prisma`:
```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  password      String
  role          UserRole  @default(STAFF)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  orders        Order[]   @relation("CreatedBy")

  @@index([email])
}

enum UserRole {
  ADMIN
  STAFF
  VIEWER
}

// Update Order model
model Order {
  // ... existing fields
  createdById   String?
  createdBy     User?     @relation("CreatedBy", fields: [createdById], references: [id])
}
```

#### B. Configure NextAuth
Create `src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const handler = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/login',
  }
});

export { handler as GET, handler as POST };
```

#### C. Protect Routes
Create middleware `src/middleware.ts`:
```typescript
import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token
  },
});

export const config = {
  matcher: ['/', '/orders/:path*', '/customers/:path*', '/payments/:path*']
};
```

---

## 3. Advanced Reporting 📊

### Prerequisites
```bash
npm install recharts date-fns
```

### Implementation Steps

#### A. Create Analytics API
Create `src/app/api/analytics/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';

export async function GET() {
  const now = new Date();
  const sixMonthsAgo = subMonths(now, 6);

  // Monthly revenue
  const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now });
  const monthlyRevenue = await Promise.all(
    months.map(async (month) => {
      const payments = await prisma.payment.findMany({
        where: {
          paymentDate: {
            gte: startOfMonth(month),
            lte: endOfMonth(month),
          },
        },
      });

      return {
        month: month.toISOString(),
        revenue: payments.reduce((sum, p) => sum + p.amount, 0),
        count: payments.length,
      };
    })
  );

  // Popular items (based on order descriptions)
  const orders = await prisma.order.findMany({
    select: { description: true },
  });

  // Customer lifetime value
  const customers = await prisma.customer.findMany({
    include: {
      orders: {
        include: { payments: true },
      },
    },
  });

  const customerLTV = customers.map((customer) => ({
    customerId: customer.id,
    customerName: customer.fullName,
    totalOrders: customer.orders.length,
    totalSpent: customer.orders.reduce((sum, order) => {
      return sum + order.payments.reduce((pSum, p) => pSum + p.amount, 0);
    }, 0),
  })).sort((a, b) => b.totalSpent - a.totalSpent);

  return NextResponse.json({
    monthlyRevenue,
    customerLTV,
  });
}
```

#### B. Create Charts Component
Create `src/components/RevenueChart.tsx`:
```typescript
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export default function RevenueChart({ data }: { data: any[] }) {
  return (
    <LineChart width={600} height={300} data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="month" />
      <YAxis />
      <Tooltip />
      <Legend />
      <Line type="monotone" dataKey="revenue" stroke="#8884d8" />
    </LineChart>
  );
}
```

---

## 4. Photo Uploads 📸

### Prerequisites
```bash
npm install uploadthing @uploadthing/react
```

### Implementation Steps

#### A. Update Prisma Schema
```prisma
model OrderPhoto {
  id        String   @id @default(cuid())
  orderId   String
  url       String
  type      PhotoType
  createdAt DateTime @default(now())

  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
}

enum PhotoType {
  DESIGN_REFERENCE
  MEASUREMENT
  COMPLETED_WORK
}

// Update Order model
model Order {
  // ... existing fields
  photos    OrderPhoto[]
}
```

#### B. Configure UploadThing
Create `src/app/api/uploadthing/core.ts`:
```typescript
import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  orderImage: f({ image: { maxFileSize: "4MB", maxFileCount: 10 } })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for file:", file.url);
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
```

#### C. Create Upload Component
```typescript
'use client';

import { UploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

export default function PhotoUpload({ orderId }: { orderId: string }) {
  return (
    <UploadButton<OurFileRouter>
      endpoint="orderImage"
      onClientUploadComplete={(res) => {
        // Save to database
        res.forEach((file) => {
          fetch('/api/photos', {
            method: 'POST',
            body: JSON.stringify({
              orderId,
              url: file.url,
              type: 'DESIGN_REFERENCE'
            })
          });
        });
      }}
    />
  );
}
```

---

## Priority Recommendation

1. **Start with Notifications** (High Impact, Low Complexity)
   - Immediate value to users
   - Uses existing urgency logic
   - Can start with email only, add SMS later

2. **Add Analytics** (Medium Impact, Medium Complexity)
   - Valuable business insights
   - Can be built incrementally

3. **Multi-user Auth** (High Complexity)
   - Only needed when multiple staff
   - Requires user management UI

4. **Photo Uploads** (Low Priority)
   - Nice to have feature
   - Can be added when needed

## Testing Strategy

For each feature:
1. Test in development environment first
2. Use test credentials (Twilio sandbox, test API keys)
3. Implement feature flags to enable/disable
4. Monitor costs (SMS, storage, etc.)
5. Get user feedback before full rollout

---

**Note**: All features are designed to integrate seamlessly with the existing Smart Trendz codebase without breaking changes to the current schema or API structure.
