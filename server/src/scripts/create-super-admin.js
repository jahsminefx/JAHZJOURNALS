const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || process.env.ADMIN_EMAIL;
  const password = process.argv[3] || process.env.ADMIN_PASSWORD;
  const name = process.argv[4] || process.env.ADMIN_NAME || 'Super Admin';

  if (!email || !password) {
    console.error('❌ Please provide email and password.');
    console.error('Usage: dokku run jahzjournals node server/src/scripts/create-super-admin.js <email> <password> [name]');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: 'SUPER_ADMIN',
      onboardingCompleted: true,
    },
    create: {
      name,
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
      onboardingCompleted: true,
    },
  });

  console.log(`✅ Success! Super Admin user (${user.email}) has been created/updated with role SUPER_ADMIN.`);
}

main()
  .catch((e) => {
    console.error('❌ Error creating Super Admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
