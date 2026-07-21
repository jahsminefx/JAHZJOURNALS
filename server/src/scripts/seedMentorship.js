const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Mentorship Phase 4...');

  // Create Mentor
  const mentorEmail = 'mentor_' + Date.now() + '@jahz.com';
  const mentorHash = await bcrypt.hash('password123', 10);
  
  const mentor = await prisma.user.create({
    data: {
      name: 'Elite Trade Mentor',
      email: mentorEmail,
      passwordHash: mentorHash,
      role: 'MENTOR',
      subscriptionPlan: 'MENTOR'
    }
  });

  const studentEmail = 'student_' + Date.now() + '@jahz.com';
  const student = await prisma.user.create({
    data: {
      name: 'Mentorship Student',
      email: studentEmail,
      passwordHash: mentorHash,
      role: 'TRADER',
      subscriptionPlan: 'PRO',
      userSettings: {
        create: {
           shareTradesWithMentor: true
        }
      }
    }
  });

  const group = await prisma.mentorGroup.create({
    data: {
      mentorId: mentor.id,
      name: 'Alpha Cohort',
      description: 'Test Group for Automated Tests'
    }
  });

  const studentAccount = await prisma.tradingAccount.create({
    data: {
      userId: student.id,
      name: 'Funded Challenge',
      startingBalance: 10000,
      currentBalance: 10000
    }
  });

  await prisma.mentorStudent.create({
    data: {
      mentorGroupId: group.id,
      studentId: student.id,
      status: 'ACTIVE'
    }
  });

  // Mock Trades for the student
  for (let i = 0; i < 5; i++) {
     await prisma.trade.create({
       data: {
         tradingAccountId: studentAccount.id,
         pair: 'EURUSD',
         direction: i % 2 === 0 ? 'BUY' : 'SELL',
         result: i % 2 === 0 ? 'WIN' : 'LOSS',
         profitLossAmount: i % 2 === 0 ? 500 : -200,
         entryTime: new Date()
       }
     });
  }

  console.log(`Successfully seeded! Mentor: ${mentorEmail}, Student: ${studentEmail}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
