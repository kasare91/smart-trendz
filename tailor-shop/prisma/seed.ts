import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Cleared existing data');

  // Create demo users
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@smarttrendz.com',
        name: 'Admin User',
        password: await bcrypt.hash('admin123', 10),
        role: 'ADMIN',
      },
    }),
    prisma.user.create({
      data: {
        email: 'staff@smarttrendz.com',
        name: 'Staff Member',
        password: await bcrypt.hash('staff123', 10),
        role: 'STAFF',
      },
    }),
    prisma.user.create({
      data: {
        email: 'viewer@smarttrendz.com',
        name: 'Viewer User',
        password: await bcrypt.hash('viewer123', 10),
        role: 'VIEWER',
      },
    }),
  ]);

  console.log('✅ Created 3 demo users');

  // Create customers
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        fullName: 'Akosua Mensah',
        phoneNumber: '+233 24 123 4567',
        email: 'akosua.mensah@example.com',
      },
    }),
    prisma.customer.create({
      data: {
        fullName: 'Kwame Osei',
        phoneNumber: '+233 20 987 6543',
        email: null,
      },
    }),
    prisma.customer.create({
      data: {
        fullName: 'Ama Boateng',
        phoneNumber: '+233 26 555 1234',
        email: 'ama.boateng@example.com',
      },
    }),
  ]);

  console.log('✅ Created 3 customers');

  // Helper to get dates relative to today
  const today = new Date();
  const getDate = (daysOffset: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + daysOffset);
    return date;
  };

  // Create orders with different statuses and due dates
  const orders = [
    // Order 1: Overdue order with partial payment
    {
      orderNumber: 'T-2025-0001',
      customerId: customers[0].id,
      description: 'Traditional Kente dress with matching headwrap',
      totalAmount: 450.0,
      status: 'IN_PROGRESS' as const,
      orderDate: getDate(-15),
      dueDate: getDate(-2), // 2 days overdue
      payments: [
        {
          amount: 200.0,
          paymentDate: getDate(-15),
          paymentMethod: 'CASH' as const,
          note: 'Initial deposit',
        },
        {
          amount: 100.0,
          paymentDate: getDate(-8),
          paymentMethod: 'MOMO' as const,
          note: 'Part payment',
        },
      ],
    },

    // Order 2: Due tomorrow with no payment
    {
      orderNumber: 'T-2025-0002',
      customerId: customers[1].id,
      description: 'Men\'s kaftan and trousers set',
      totalAmount: 280.0,
      status: 'READY' as const,
      orderDate: getDate(-10),
      dueDate: getDate(1), // Due tomorrow
      payments: [
        {
          amount: 280.0,
          paymentDate: getDate(-10),
          paymentMethod: 'CASH' as const,
          note: 'Full payment upfront',
        },
      ],
    },

    // Order 3: Due in 3 days with partial payment
    {
      orderNumber: 'T-2025-0003',
      customerId: customers[2].id,
      description: 'Wedding gown with embroidery',
      totalAmount: 850.0,
      status: 'IN_PROGRESS' as const,
      orderDate: getDate(-20),
      dueDate: getDate(3), // Due in 3 days
      payments: [
        {
          amount: 400.0,
          paymentDate: getDate(-20),
          paymentMethod: 'CARD' as const,
          note: 'Initial deposit',
        },
        {
          amount: 200.0,
          paymentDate: getDate(-5),
          paymentMethod: 'MOMO' as const,
          note: 'Second installment',
        },
      ],
    },

    // Order 4: Due in 5 days, fully paid
    {
      orderNumber: 'T-2025-0004',
      customerId: customers[0].id,
      description: 'Business suit alterations',
      totalAmount: 120.0,
      status: 'PENDING' as const,
      orderDate: getDate(-5),
      dueDate: getDate(5), // Due in 5 days
      payments: [
        {
          amount: 60.0,
          paymentDate: getDate(-5),
          paymentMethod: 'CASH' as const,
          note: 'Deposit',
        },
        {
          amount: 60.0,
          paymentDate: getDate(-1),
          paymentMethod: 'CASH' as const,
          note: 'Final payment',
        },
      ],
    },

    // Order 5: Safe (10 days away) with partial payment
    {
      orderNumber: 'T-2025-0005',
      customerId: customers[1].id,
      description: 'Three-piece agbada set with cap',
      totalAmount: 680.0,
      status: 'PENDING' as const,
      orderDate: getDate(-3),
      dueDate: getDate(10), // 10 days away
      payments: [
        {
          amount: 300.0,
          paymentDate: getDate(-3),
          paymentMethod: 'MOMO' as const,
          note: 'Down payment',
        },
      ],
    },

    // Order 6: Collected order (completed)
    {
      orderNumber: 'T-2025-0006',
      customerId: customers[2].id,
      description: 'Children\'s party dress',
      totalAmount: 180.0,
      status: 'COLLECTED' as const,
      orderDate: getDate(-30),
      dueDate: getDate(-10),
      payments: [
        {
          amount: 90.0,
          paymentDate: getDate(-30),
          paymentMethod: 'CASH' as const,
          note: 'Initial payment',
        },
        {
          amount: 90.0,
          paymentDate: getDate(-10),
          paymentMethod: 'CASH' as const,
          note: 'Balance on collection',
        },
      ],
    },

    // Order 7: Due today with outstanding balance
    {
      orderNumber: 'T-2025-0007',
      customerId: customers[0].id,
      description: 'Office blazer and skirt',
      totalAmount: 320.0,
      status: 'READY' as const,
      orderDate: getDate(-7),
      dueDate: getDate(0), // Due today
      payments: [
        {
          amount: 160.0,
          paymentDate: getDate(-7),
          paymentMethod: 'CARD' as const,
          note: '50% deposit',
        },
      ],
    },
  ];

  // Create orders with their payments
  for (const orderData of orders) {
    const { payments, ...orderDetails } = orderData;

    const order = await prisma.order.create({
      data: {
        ...orderDetails,
        payments: {
          create: payments,
        },
      },
      include: {
        payments: true,
      },
    });

    console.log(`✅ Created order ${order.orderNumber}`);
  }

  console.log('🎉 Seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Users: ${users.length}`);
  console.log(`   - Customers: ${customers.length}`);
  console.log(`   - Orders: ${orders.length}`);
  console.log(`   - Payments: ${orders.reduce((sum, o) => sum + o.payments.length, 0)}`);
  console.log('\n🔍 Due date distribution:');
  console.log('   - Overdue: 1 order');
  console.log('   - Due today: 1 order');
  console.log('   - Due tomorrow: 1 order');
  console.log('   - Due in 3 days: 1 order');
  console.log('   - Due in 5 days: 1 order');
  console.log('   - Due in 10 days: 1 order');
  console.log('   - Collected: 1 order');
  console.log('\n👥 Demo Users:');
  console.log('   - admin@smarttrendz.com (password: admin123)');
  console.log('   - staff@smarttrendz.com (password: staff123)');
  console.log('   - viewer@smarttrendz.com (password: viewer123)');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
