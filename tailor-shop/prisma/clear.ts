import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Clearing all sample data from database...');

  try {
    // Delete in correct order to respect foreign key constraints
    await prisma.payment.deleteMany();
    console.log('✅ Deleted all payments');

    await prisma.order.deleteMany();
    console.log('✅ Deleted all orders');

    await prisma.customer.deleteMany();
    console.log('✅ Deleted all customers');

    await prisma.user.deleteMany();
    console.log('✅ Deleted all users');

    console.log('');
    console.log('🎉 Database cleared successfully!');
    console.log('');
    console.log('Note: You will need to create a new user account to log in.');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
