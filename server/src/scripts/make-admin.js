const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  
  if (!email) {
    console.error('❌ Please provide an email address.');
    console.error('Usage: npm run make-admin user@example.com');
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.error(`❌ User not found with email: ${email}`);
      process.exit(1);
    }

    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      console.log(`⚠️ User ${email} is already an ${user.role}.`);
      process.exit(0);
    }

    await prisma.user.update({
      where: { email },
      data: { role: 'SUPER_ADMIN' }
    });

    console.log(`✅ Success! ${email} has been promoted to SUPER_ADMIN.`);
  } catch (error) {
    console.error('❌ Failed to promote user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
