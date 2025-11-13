import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  await prisma.activityLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();

  console.log('✅ Cleared existing data');

  // Create branches
  const accra = await prisma.branch.create({
    data: {
      name: 'Accra',
      location: 'Accra, Greater Accra Region',
      active: true,
    },
  });

  const koforidua = await prisma.branch.create({
    data: {
      name: 'Koforidua',
      location: 'Koforidua, Eastern Region',
      active: true,
    },
  });

  console.log('✅ Created 2 branches: Accra and Koforidua');

  // Create admin user with access to all branches
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@smarttrendz.com',
      name: 'Admin User',
      password: await bcrypt.hash('admin123', 10),
      role: 'ADMIN',
      branchId: null, // Admin has access to all branches
      active: true,
    },
  });

  console.log('✅ Created admin user');

  // Create demo staff users for each branch
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'accra@smarttrendz.com',
        name: 'Accra Staff',
        password: await bcrypt.hash('staff123', 10),
        role: 'STAFF',
        branchId: accra.id,
        active: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'koforidua@smarttrendz.com',
        name: 'Koforidua Staff',
        password: await bcrypt.hash('staff123', 10),
        role: 'STAFF',
        branchId: koforidua.id,
        active: true,
      },
    }),
  ]);

  console.log('✅ Created 2 demo staff users (1 per branch)');

  // Create customers for each branch
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        fullName: 'Akosua Mensah',
        phoneNumber: '+233 24 123 4567',
        email: 'akosua.mensah@example.com',
        branchId: accra.id,
        createdBy: users[0].id,
      },
    }),
    prisma.customer.create({
      data: {
        fullName: 'Kwame Osei',
        phoneNumber: '+233 20 987 6543',
        email: null,
        branchId: accra.id,
        createdBy: users[0].id,
      },
    }),
    prisma.customer.create({
      data: {
        fullName: 'Ama Boateng',
        phoneNumber: '+233 26 555 1234',
        email: 'ama.boateng@example.com',
        branchId: koforidua.id,
        createdBy: users[1].id,
      },
    }),
  ]);

  console.log('✅ Created 3 customers (2 Accra, 1 Koforidua)');

  // Helper to get dates relative to today
  const today = new Date();
  const getDate = (daysOffset: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + daysOffset);
    return date;
  };

  // Create orders with different statuses and due dates
  const orders = [
    // Order 1: Overdue order with partial payment (Accra)
    {
      orderNumber: 'T-2025-0001',
      customerId: customers[0].id,
      branchId: accra.id,
      description: 'Traditional Kente dress with matching headwrap',
      totalAmount: 450.0,
      status: 'IN_PROGRESS' as const,
      orderDate: getDate(-15),
      dueDate: getDate(-2), // 2 days overdue
      createdBy: users[0].id,
      payments: [
        {
          amount: 200.0,
          paymentDate: getDate(-15),
          paymentMethod: 'CASH' as const,
          note: 'Initial deposit',
          createdBy: users[0].id,
        },
        {
          amount: 100.0,
          paymentDate: getDate(-8),
          paymentMethod: 'MOMO' as const,
          note: 'Part payment',
          createdBy: users[0].id,
        },
      ],
    },

    // Order 2: Due tomorrow with no payment (Accra)
    {
      orderNumber: 'T-2025-0002',
      customerId: customers[1].id,
      branchId: accra.id,
      description: 'Men\'s kaftan and trousers set',
      totalAmount: 280.0,
      status: 'READY' as const,
      orderDate: getDate(-10),
      dueDate: getDate(1), // Due tomorrow
      createdBy: users[0].id,
      payments: [
        {
          amount: 280.0,
          paymentDate: getDate(-10),
          paymentMethod: 'CASH' as const,
          note: 'Full payment upfront',
          createdBy: users[0].id,
        },
      ],
    },

    // Order 3: Due in 3 days with partial payment (Koforidua)
    {
      orderNumber: 'T-2025-0003',
      customerId: customers[2].id,
      branchId: koforidua.id,
      description: 'Wedding gown with embroidery',
      totalAmount: 850.0,
      status: 'IN_PROGRESS' as const,
      orderDate: getDate(-20),
      dueDate: getDate(3), // Due in 3 days
      createdBy: users[1].id,
      payments: [
        {
          amount: 400.0,
          paymentDate: getDate(-20),
          paymentMethod: 'CARD' as const,
          note: 'Initial deposit',
          createdBy: users[1].id,
        },
        {
          amount: 200.0,
          paymentDate: getDate(-5),
          paymentMethod: 'MOMO' as const,
          note: 'Second installment',
          createdBy: users[1].id,
        },
      ],
    },

    // Order 4: Due in 5 days, fully paid (Accra)
    {
      orderNumber: 'T-2025-0004',
      customerId: customers[0].id,
      branchId: accra.id,
      description: 'Business suit alterations',
      totalAmount: 120.0,
      status: 'PENDING' as const,
      orderDate: getDate(-5),
      dueDate: getDate(5), // Due in 5 days
      createdBy: users[0].id,
      payments: [
        {
          amount: 60.0,
          paymentDate: getDate(-5),
          paymentMethod: 'CASH' as const,
          note: 'Deposit',
          createdBy: users[0].id,
        },
        {
          amount: 60.0,
          paymentDate: getDate(-1),
          paymentMethod: 'CASH' as const,
          note: 'Final payment',
          createdBy: users[0].id,
        },
      ],
    },

    // Order 5: Safe (10 days away) with partial payment (Accra)
    {
      orderNumber: 'T-2025-0005',
      customerId: customers[1].id,
      branchId: accra.id,
      description: 'Three-piece agbada set with cap',
      totalAmount: 680.0,
      status: 'PENDING' as const,
      orderDate: getDate(-3),
      dueDate: getDate(10), // 10 days away
      createdBy: users[0].id,
      payments: [
        {
          amount: 300.0,
          paymentDate: getDate(-3),
          paymentMethod: 'MOMO' as const,
          note: 'Down payment',
          createdBy: users[0].id,
        },
      ],
    },

    // Order 6: Collected order (completed) (Koforidua)
    {
      orderNumber: 'T-2025-0006',
      customerId: customers[2].id,
      branchId: koforidua.id,
      description: 'Children\'s party dress',
      totalAmount: 180.0,
      status: 'COLLECTED' as const,
      orderDate: getDate(-30),
      dueDate: getDate(-10),
      createdBy: users[1].id,
      payments: [
        {
          amount: 90.0,
          paymentDate: getDate(-30),
          paymentMethod: 'CASH' as const,
          note: 'Initial payment',
          createdBy: users[1].id,
        },
        {
          amount: 90.0,
          paymentDate: getDate(-10),
          paymentMethod: 'CASH' as const,
          note: 'Balance on collection',
          createdBy: users[1].id,
        },
      ],
    },

    // Order 7: Due today with outstanding balance (Accra)
    {
      orderNumber: 'T-2025-0007',
      customerId: customers[0].id,
      branchId: accra.id,
      description: 'Office blazer and skirt',
      totalAmount: 320.0,
      status: 'READY' as const,
      orderDate: getDate(-7),
      dueDate: getDate(0), // Due today
      createdBy: users[0].id,
      payments: [
        {
          amount: 160.0,
          paymentDate: getDate(-7),
          paymentMethod: 'CARD' as const,
          note: '50% deposit',
          createdBy: users[0].id,
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
  console.log(`   - Branches: 2 (Accra, Koforidua)`);
  console.log(`   - Users: ${users.length + 1} (1 admin + ${users.length} staff)`);
  console.log(`   - Customers: ${customers.length} (2 Accra, 1 Koforidua)`);
  console.log(`   - Orders: ${orders.length} (5 Accra, 2 Koforidua)`);
  console.log(`   - Payments: ${orders.reduce((sum, o) => sum + o.payments.length, 0)}`);
  console.log('\n🏢 Branches:');
  console.log('   - Accra: 2 customers, 5 orders');
  console.log('   - Koforidua: 1 customer, 2 orders');
  console.log('\n🔍 Due date distribution:');
  console.log('   - Overdue: 1 order');
  console.log('   - Due today: 1 order');
  console.log('   - Due tomorrow: 1 order');
  console.log('   - Due in 3 days: 1 order');
  console.log('   - Due in 5 days: 1 order');
  console.log('   - Due in 10 days: 1 order');
  console.log('   - Collected: 1 order');
  console.log('\n👥 Demo Users:');
  console.log('   - admin@smarttrendz.com (password: admin123) - ADMIN (all branches)');
  console.log('   - accra@smarttrendz.com (password: staff123) - STAFF (Accra)');
  console.log('   - koforidua@smarttrendz.com (password: staff123) - STAFF (Koforidua)');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
