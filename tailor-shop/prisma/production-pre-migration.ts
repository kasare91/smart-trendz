/**
 * PRODUCTION PRE-MIGRATION SCRIPT
 *
 * Run this BEFORE deploying the new schema to production.
 * This prepares existing data for the multi-branch system.
 *
 * IMPORTANT: This script expects the OLD schema where branchId is nullable.
 * Do NOT run this on a database that already has the new schema.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting PRODUCTION pre-migration...\n');
  console.log('⚠️  IMPORTANT: This script should only be run on production databases');
  console.log('   with the OLD schema (before deploying the multi-branch changes).\n');

  try {
    // Step 1: Create branches
    console.log('📍 Step 1: Creating branches...');

    // Check if branches already exist
    const existingBranches = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count FROM "Branch"
    `;

    if (existingBranches[0].count > 0) {
      console.log('✅ Branches already exist, skipping creation...\n');
    } else {
      await prisma.$executeRaw`
        INSERT INTO "Branch" (id, name, location, active, "createdAt", "updatedAt")
        VALUES
          (gen_random_uuid()::text, 'Accra', 'Accra, Greater Accra Region', true, NOW(), NOW()),
          (gen_random_uuid()::text, 'Koforidua', 'Koforidua, Eastern Region', true, NOW(), NOW())
      `;
      console.log('✅ Created Accra and Koforidua branches\n');
    }

    // Get branch IDs
    const branches = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
      SELECT id, name FROM "Branch" ORDER BY name
    `;

    const accraBranch = branches.find(b => b.name === 'Accra');
    const koforidua = branches.find(b => b.name === 'Koforidua');

    if (!accraBranch) {
      throw new Error('Accra branch not found after creation');
    }

    console.log(`✅ Branch IDs:`);
    console.log(`   Accra: ${accraBranch.id}`);
    console.log(`   Koforidua: ${koforidua?.id}\n`);

    // Step 2: Update customers - assign all to Accra
    console.log('👥 Step 2: Migrating customers...');

    const customersToUpdate = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count FROM "Customer" WHERE "branchId" IS NULL
    `;

    if (customersToUpdate[0].count > 0) {
      const customerCount = await prisma.$executeRaw`
        UPDATE "Customer"
        SET
          "branchId" = ${accraBranch.id},
          "createdBy" = 'MIGRATION',
          "updatedBy" = 'MIGRATION'
        WHERE "branchId" IS NULL
      `;
      console.log(`✅ Updated ${customerCount} customers to Accra branch\n`);
    } else {
      console.log('✅ All customers already have branch assignments\n');
    }

    // Step 3: Update orders - assign to customer's branch
    console.log('📦 Step 3: Migrating orders...');

    const ordersToUpdate = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count FROM "Order" WHERE "branchId" IS NULL
    `;

    if (ordersToUpdate[0].count > 0) {
      const orderCount = await prisma.$executeRaw`
        UPDATE "Order" o
        SET
          "branchId" = c."branchId",
          "createdBy" = 'MIGRATION',
          "updatedBy" = 'MIGRATION'
        FROM "Customer" c
        WHERE o."customerId" = c.id
        AND o."branchId" IS NULL
      `;
      console.log(`✅ Updated ${orderCount} orders to match customer branches\n`);
    } else {
      console.log('✅ All orders already have branch assignments\n');
    }

    // Step 4: Update payments
    console.log('💰 Step 4: Migrating payments...');

    const paymentsToUpdate = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count FROM "Payment" WHERE "createdBy" IS NULL
    `;

    if (paymentsToUpdate[0].count > 0) {
      const paymentCount = await prisma.$executeRaw`
        UPDATE "Payment"
        SET "createdBy" = 'MIGRATION'
        WHERE "createdBy" IS NULL
      `;
      console.log(`✅ Updated ${paymentCount} payments with creator tracking\n`);
    } else {
      console.log('✅ All payments already have creator tracking\n');
    }

    // Step 5: Create/update admin user
    console.log('👨‍💼 Step 5: Setting up admin user...');

    const existingAdmin = await prisma.$queryRaw<Array<{ email: string }>>`
      SELECT email FROM "User" WHERE email = 'admin@example.com'
    `;

    const hashedPassword = await bcrypt.hash('admin123', 10);

    if (existingAdmin.length > 0) {
      await prisma.$executeRaw`
        UPDATE "User"
        SET
          role = 'ADMIN',
          "branchId" = NULL,
          active = true,
          password = ${hashedPassword}
        WHERE email = 'admin@example.com'
      `;
      console.log('✅ Updated existing admin user\n');
    } else {
      await prisma.$executeRaw`
        INSERT INTO "User" (id, email, name, password, role, "branchId", active, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          'admin@example.com',
          'Admin User',
          ${hashedPassword},
          'ADMIN',
          NULL,
          true,
          NOW(),
          NOW()
        )
      `;
      console.log('✅ Created admin user\n');
    }

    // Step 6: Update staff users to have branch assignments
    console.log('👷 Step 6: Migrating staff users...');

    const staffToUpdate = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count
      FROM "User"
      WHERE role IN ('STAFF', 'VIEWER')
      AND "branchId" IS NULL
    `;

    if (staffToUpdate[0].count > 0) {
      const staffCount = await prisma.$executeRaw`
        UPDATE "User"
        SET "branchId" = ${accraBranch.id}
        WHERE role IN ('STAFF', 'VIEWER')
        AND "branchId" IS NULL
      `;
      console.log(`✅ Updated ${staffCount} staff users to Accra branch\n`);
    } else {
      console.log('✅ All staff users already have branch assignments\n');
    }

    // Step 7: Generate summary report
    console.log('📊 Migration Summary:');
    console.log('═══════════════════════════════════════\n');

    const summary = await prisma.$queryRaw<Array<{
      branch_name: string;
      customers: number;
      orders: number;
      users: number;
    }>>`
      SELECT
        b.name as branch_name,
        COUNT(DISTINCT c.id) as customers,
        COUNT(DISTINCT o.id) as orders,
        COUNT(DISTINCT u.id) as users
      FROM "Branch" b
      LEFT JOIN "Customer" c ON c."branchId" = b.id
      LEFT JOIN "Order" o ON o."branchId" = b.id
      LEFT JOIN "User" u ON u."branchId" = b.id
      GROUP BY b.name
      ORDER BY b.name
    `;

    for (const row of summary) {
      console.log(`🏢 ${row.branch_name}`);
      console.log(`   Users: ${row.users}`);
      console.log(`   Customers: ${row.customers}`);
      console.log(`   Orders: ${row.orders}\n`);
    }

    const userRoles = await prisma.$queryRaw<Array<{ role: string; count: number }>>`
      SELECT role, COUNT(*) as count
      FROM "User"
      GROUP BY role
      ORDER BY role
    `;

    console.log('👥 User Roles:');
    for (const role of userRoles) {
      console.log(`   ${role.role}: ${role.count}`);
    }

    console.log('\n✅ Pre-migration completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('1. Verify the migration results above');
    console.log('2. Check your database to ensure all data looks correct');
    console.log('3. Deploy the new application code to Vercel');
    console.log('4. Test with admin@example.com / admin123');
    console.log('5. Review and reassign customers/users to correct branches as needed\n');

    console.log('🔐 Demo Login Credentials:');
    console.log('   Admin: admin@example.com / admin123');
    console.log('   (Create branch-specific staff users after deployment)\n');

  } catch (error: any) {
    console.error('\n❌ Pre-migration failed:', error);
    console.error('\nError details:', error.message);

    if (error.message.includes('does not exist')) {
      console.error('\n⚠️  This error suggests the database schema is not in the expected state.');
      console.error('   Make sure you are running this on a production database with the OLD schema.');
      console.error('   If the new schema is already deployed, you may not need this migration.\n');
    }

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
