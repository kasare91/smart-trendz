import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SEED BLOCKED: never run seed in production.');
  }

  console.log('🌱 Starting database seed...');
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? crypto.randomUUID();
  const staffPassword = crypto.randomUUID();
  console.info(`[seed] admin password: ${adminPassword}`);
  console.info(`[seed] staff password: ${staffPassword}`);
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  const staffPasswordHash = await bcrypt.hash(staffPassword, 10);

  // Clear all data in dependency order
  await prisma.passwordResetToken.deleteMany();
  await prisma.orderNotificationLog.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.fabricStock.deleteMany();
  await prisma.measurement.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.businessProfile.deleteMany();
  await prisma.tenant.deleteMany();

  console.log('✅ Cleared existing data');

  // 1. Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Boutique',
      slug: 'demo-boutique',
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Created tenant: ${tenant.name}`);

  // 2. Create business profile linked to tenant
  const businessProfile = await prisma.businessProfile.create({
    data: {
      tenantId: tenant.id,
      businessName: 'Demo Boutique',
      businessType: 'Tailor Shop',
      ownerName: 'Demo Owner',
      phoneNumber: '+233 24 000 0000',
      email: 'hello@example.com',
      address: '123 Sample Street',
      city: 'Accra',
      country: 'Ghana',
      currency: 'GHS',
      invoicePrefix: 'ORD',
      receiptFooterNote: 'Thank you for your business.',
    },
  });

  console.log(`✅ Created business profile: ${businessProfile.businessName}`);

  // 3. Create branches linked to tenant
  const accra = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      name: 'Accra',
      location: 'Accra, Greater Accra Region',
      active: true,
    },
  });

  const koforidua = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      name: 'Koforidua',
      location: 'Koforidua, Eastern Region',
      active: true,
    },
  });

  console.log('✅ Created 2 branches: Accra and Koforidua');

  // 4. Create admin user linked to tenant (no branch)
  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@example.com',
      name: 'Admin User',
      password: adminPasswordHash,
      role: 'ADMIN',
      branchId: null,
      active: true,
    },
  });

  console.log('✅ Created admin user');

  // 5. Create staff users linked to tenant + branch
  const accraStaff = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'accra@example.com',
      name: 'Accra Staff',
      password: staffPasswordHash,
      role: 'STAFF',
      branchId: accra.id,
      active: true,
    },
  });

  const koforiduaStaff = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'koforidua@example.com',
      name: 'Koforidua Staff',
      password: staffPasswordHash,
      role: 'STAFF',
      branchId: koforidua.id,
      active: true,
    },
  });

  console.log('✅ Created 2 staff users');

  // 6. Create customers
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        fullName: 'Akosua Mensah',
        phoneNumber: '+233 24 123 4567',
        email: 'akosua.mensah@example.com',
        branchId: accra.id,
        createdBy: accraStaff.id,
      },
    }),
    prisma.customer.create({
      data: {
        fullName: 'Kwame Osei',
        phoneNumber: '+233 20 987 6543',
        branchId: accra.id,
        createdBy: accraStaff.id,
      },
    }),
    prisma.customer.create({
      data: {
        fullName: 'Ama Boateng',
        phoneNumber: '+233 26 555 1234',
        email: 'ama.boateng@example.com',
        branchId: koforidua.id,
        createdBy: koforiduaStaff.id,
      },
    }),
  ]);

  console.log('✅ Created 3 customers');

  // Helper to get dates relative to today
  const today = new Date();
  const getDate = (daysOffset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + daysOffset);
    return d;
  };

  // 7. Create orders with payments
  const ordersData = [
    {
      orderNumber: 'ORD-2026-0001',
      customerId: customers[0].id,
      branchId: accra.id,
      description: 'Traditional Kente dress with matching headwrap',
      totalAmount: 450.0,
      status: 'IN_PROGRESS',
      orderDate: getDate(-15),
      dueDate: getDate(-2),
      createdBy: adminUser.id,
      payments: [
        { amount: 200.0, paymentDate: getDate(-15), paymentMethod: 'CASH', note: 'Initial deposit', createdBy: adminUser.id },
        { amount: 100.0, paymentDate: getDate(-8), paymentMethod: 'MOMO', note: 'Part payment', createdBy: adminUser.id },
      ],
    },
    {
      orderNumber: 'ORD-2026-0002',
      customerId: customers[1].id,
      branchId: accra.id,
      description: "Men's kaftan and trousers set",
      totalAmount: 280.0,
      status: 'READY',
      orderDate: getDate(-10),
      dueDate: getDate(1),
      createdBy: accraStaff.id,
      payments: [
        { amount: 280.0, paymentDate: getDate(-10), paymentMethod: 'CASH', note: 'Full payment upfront', createdBy: accraStaff.id },
      ],
    },
    {
      orderNumber: 'ORD-2026-0003',
      customerId: customers[2].id,
      branchId: koforidua.id,
      description: 'Wedding gown with embroidery',
      totalAmount: 850.0,
      status: 'IN_PROGRESS',
      orderDate: getDate(-20),
      dueDate: getDate(3),
      createdBy: koforiduaStaff.id,
      payments: [
        { amount: 400.0, paymentDate: getDate(-20), paymentMethod: 'CARD', note: 'Initial deposit', createdBy: koforiduaStaff.id },
        { amount: 200.0, paymentDate: getDate(-5), paymentMethod: 'MOMO', note: 'Second installment', createdBy: koforiduaStaff.id },
      ],
    },
    {
      orderNumber: 'ORD-2026-0004',
      customerId: customers[0].id,
      branchId: accra.id,
      description: 'Business suit alterations',
      totalAmount: 120.0,
      status: 'COLLECTED',
      orderDate: getDate(-30),
      dueDate: getDate(-10),
      createdBy: adminUser.id,
      payments: [
        { amount: 60.0, paymentDate: getDate(-30), paymentMethod: 'CASH', note: 'Deposit', createdBy: adminUser.id },
        { amount: 60.0, paymentDate: getDate(-10), paymentMethod: 'CASH', note: 'Balance on collection', createdBy: adminUser.id },
      ],
    },
  ];

  for (const { payments, ...orderDetails } of ordersData) {
    const order = await prisma.order.create({
      data: {
        ...orderDetails,
        payments: { create: payments },
      },
    });
    console.log(`✅ Created order ${order.orderNumber}`);
  }

  console.log('\n🎉 Seed complete');
  console.log(`\n👥 Login credentials:`);
  console.log(`   admin@example.com  / ${adminPassword}  (ADMIN)`);
  console.log(`   accra@example.com  / ${staffPassword}  (STAFF – Accra)`);
  console.log(`   koforidua@example.com / ${staffPassword}  (STAFF – Koforidua)`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
