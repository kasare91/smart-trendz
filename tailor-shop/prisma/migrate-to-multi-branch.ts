/**
 * Data Migration Script: Migrate existing data to multi-branch system
 *
 * This script:
 * 1. Creates the two branches (Accra and Koforidua)
 * 2. Assigns all existing customers to a default branch (Accra)
 * 3. Assigns all existing orders to match their customer's branch
 * 4. Updates all existing users to have a branch assignment
 * 5. Creates the admin user if it doesn't exist
 *
 * IMPORTANT: Run this BEFORE deploying the new schema to production
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting data migration to multi-branch system...\n');

  try {
    // Step 1: Create branches if they don't exist
    console.log('📍 Step 1: Creating branches...');

    let accraBranch = await prisma.branch.findUnique({
      where: { name: 'Accra' },
    });

    if (!accraBranch) {
      accraBranch = await prisma.branch.create({
        data: {
          name: 'Accra',
          location: 'Accra, Greater Accra Region',
          active: true,
        },
      });
      console.log('✅ Created Accra branch:', accraBranch.id);
    } else {
      console.log('✅ Accra branch already exists:', accraBranch.id);
    }

    let koforidua = await prisma.branch.findUnique({
      where: { name: 'Koforidua' },
    });

    if (!koforidua) {
      koforidua = await prisma.branch.create({
        data: {
          name: 'Koforidua',
          location: 'Koforidua, Eastern Region',
          active: true,
        },
      });
      console.log('✅ Created Koforidua branch:', koforidua.id);
    } else {
      console.log('✅ Koforidua branch already exists:', koforidua.id);
    }

    // Step 2: Update existing customers without a branch
    console.log('\n👥 Step 2: Migrating customers...');

    const customersWithoutBranch = await prisma.customer.findMany({
      where: {
        OR: [
          { branchId: null },
          { branchId: '' },
        ],
      },
    });

    if (customersWithoutBranch.length > 0) {
      console.log(`Found ${customersWithoutBranch.length} customers without branch assignment`);

      for (const customer of customersWithoutBranch) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            branchId: accraBranch.id, // Assign to Accra by default
            createdBy: 'MIGRATION', // Track that this was migrated
            updatedBy: 'MIGRATION',
          },
        });
      }

      console.log(`✅ Assigned ${customersWithoutBranch.length} customers to Accra branch`);
    } else {
      console.log('✅ All customers already have branch assignments');
    }

    // Step 3: Update existing orders without a branch
    console.log('\n📦 Step 3: Migrating orders...');

    const ordersWithoutBranch = await prisma.order.findMany({
      where: {
        OR: [
          { branchId: null },
          { branchId: '' },
        ],
      },
      include: {
        customer: true,
      },
    });

    if (ordersWithoutBranch.length > 0) {
      console.log(`Found ${ordersWithoutBranch.length} orders without branch assignment`);

      for (const order of ordersWithoutBranch) {
        // Assign order to the same branch as its customer
        await prisma.order.update({
          where: { id: order.id },
          data: {
            branchId: order.customer.branchId,
            createdBy: 'MIGRATION',
            updatedBy: 'MIGRATION',
          },
        });
      }

      console.log(`✅ Assigned ${ordersWithoutBranch.length} orders to their customer's branches`);
    } else {
      console.log('✅ All orders already have branch assignments');
    }

    // Step 4: Update existing payments without createdBy
    console.log('\n💰 Step 4: Migrating payments...');

    const paymentsWithoutCreator = await prisma.payment.findMany({
      where: {
        OR: [
          { createdBy: null },
          { createdBy: '' },
        ],
      },
    });

    if (paymentsWithoutCreator.length > 0) {
      console.log(`Found ${paymentsWithoutCreator.length} payments without creator tracking`);

      for (const payment of paymentsWithoutCreator) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            createdBy: 'MIGRATION',
          },
        });
      }

      console.log(`✅ Updated ${paymentsWithoutCreator.length} payments with creator tracking`);
    } else {
      console.log('✅ All payments already have creator tracking');
    }

    // Step 5: Create or update admin user
    console.log('\n👨‍💼 Step 5: Setting up admin user...');

    let adminUser = await prisma.user.findUnique({
      where: { email: 'admin@smarttrendz.com' },
    });

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: 'admin@smarttrendz.com',
          name: 'Admin User',
          password: await bcrypt.hash('admin123', 10),
          role: 'ADMIN',
          branchId: null, // Admin has access to all branches
          active: true,
        },
      });
      console.log('✅ Created admin user: admin@smarttrendz.com');
    } else {
      // Update existing admin to ensure proper role and branch assignment
      adminUser = await prisma.user.update({
        where: { email: 'admin@smarttrendz.com' },
        data: {
          role: 'ADMIN',
          branchId: null, // Ensure admin has no branch restriction
          active: true,
        },
      });
      console.log('✅ Updated existing admin user: admin@smarttrendz.com');
    }

    // Step 6: Update existing staff users to have branch assignments
    console.log('\n👷 Step 6: Migrating staff users...');

    const staffWithoutBranch = await prisma.user.findMany({
      where: {
        role: { in: ['STAFF', 'VIEWER'] },
        OR: [
          { branchId: null },
          { branchId: '' },
        ],
      },
    });

    if (staffWithoutBranch.length > 0) {
      console.log(`Found ${staffWithoutBranch.length} staff users without branch assignment`);

      for (const staff of staffWithoutBranch) {
        await prisma.user.update({
          where: { id: staff.id },
          data: {
            branchId: accraBranch.id, // Assign to Accra by default
          },
        });
      }

      console.log(`✅ Assigned ${staffWithoutBranch.length} staff users to Accra branch`);
    } else {
      console.log('✅ All staff users already have branch assignments');
    }

    // Step 7: Create demo staff users for each branch if they don't exist
    console.log('\n👥 Step 7: Creating demo staff users...');

    const accraStaff = await prisma.user.findUnique({
      where: { email: 'accra@smarttrendz.com' },
    });

    if (!accraStaff) {
      await prisma.user.create({
        data: {
          email: 'accra@smarttrendz.com',
          name: 'Accra Staff',
          password: await bcrypt.hash('staff123', 10),
          role: 'STAFF',
          branchId: accraBranch.id,
          active: true,
        },
      });
      console.log('✅ Created Accra staff user: accra@smarttrendz.com');
    } else {
      console.log('✅ Accra staff user already exists');
    }

    const koforidiaStaff = await prisma.user.findUnique({
      where: { email: 'koforidua@smarttrendz.com' },
    });

    if (!koforidiaStaff) {
      await prisma.user.create({
        data: {
          email: 'koforidua@smarttrendz.com',
          name: 'Koforidua Staff',
          password: await bcrypt.hash('staff123', 10),
          role: 'STAFF',
          branchId: koforidua.id,
          active: true,
        },
      });
      console.log('✅ Created Koforidua staff user: koforidua@smarttrendz.com');
    } else {
      console.log('✅ Koforidua staff user already exists');
    }

    // Step 8: Generate summary report
    console.log('\n📊 Migration Summary:');
    console.log('═══════════════════════════════════════');

    const branches = await prisma.branch.findMany({
      include: {
        _count: {
          select: {
            users: true,
            customers: true,
            orders: true,
          },
        },
      },
    });

    for (const branch of branches) {
      console.log(`\n🏢 ${branch.name} (${branch.location})`);
      console.log(`   Users: ${branch._count.users}`);
      console.log(`   Customers: ${branch._count.customers}`);
      console.log(`   Orders: ${branch._count.orders}`);
    }

    const totalUsers = await prisma.user.count();
    const adminUsers = await prisma.user.count({ where: { role: 'ADMIN' } });
    const staffUsers = await prisma.user.count({ where: { role: 'STAFF' } });
    const viewerUsers = await prisma.user.count({ where: { role: 'VIEWER' } });

    console.log('\n👥 User Summary:');
    console.log(`   Total: ${totalUsers}`);
    console.log(`   Admin: ${adminUsers}`);
    console.log(`   Staff: ${staffUsers}`);
    console.log(`   Viewer: ${viewerUsers}`);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next Steps:');
    console.log('1. Verify the migration results above');
    console.log('2. Test login with admin@smarttrendz.com / admin123');
    console.log('3. Review user assignments and adjust if needed');
    console.log('4. Deploy the new schema to production');
    console.log('5. Run this migration script on production BEFORE the deployment');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
