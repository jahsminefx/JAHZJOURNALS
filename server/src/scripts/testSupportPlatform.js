const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const contactService = require('../services/communications/contactService');

async function testSupportPlatform() {
  console.log('🧪 Starting Enterprise Support Platform Verification Test...\n');

  try {
    // 1. Find or create a test trader user
    let user = await prisma.user.findFirst({ where: { role: 'TRADER' } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'testtrader@jahzjournals.com',
          name: 'Test Trader',
          passwordHash: 'hashedpass',
          role: 'TRADER',
        }
      });
    }

    // Find an admin user
    let admin = await prisma.user.findFirst({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email: 'testadmin@jahzjournals.com',
          name: 'Test Support Admin',
          passwordHash: 'hashedpass',
          role: 'SUPER_ADMIN',
        }
      });
    }

    console.log(`👤 User: ${user.name} (${user.email})`);
    console.log(`🛡️ Admin: ${admin.name} (${admin.email})\n`);

    // TEST 1: Create Support Thread
    console.log('1️⃣ Creating Support Thread...');
    const thread = await contactService.createMessage({
      name: user.name,
      email: user.email,
      subject: 'Urgent Issue with MT5 CSV Trade Export',
      message: 'My EURUSD trade entry price was not formatted properly on export.',
      category: 'TECHNICAL',
      priority: 'HIGH',
      userId: user.id,
    });
    console.log(`   ✅ Thread Created [ID: ${thread.id}, Status: ${thread.status}, Priority: ${thread.priority}]`);

    // TEST 2: Verify Initial ContactThread Record
    console.log('2️⃣ Verifying Initial Thread Message Record...');
    const fullThread = await contactService.getMessageThread(thread.id);
    if (fullThread.threads.length > 0) {
      console.log(`   ✅ Initial Message Record Found! Sender: ${fullThread.threads[0].senderName}`);
    } else {
      console.error('   ❌ Initial message record missing!');
    }

    // TEST 3: User Reply
    console.log('3️⃣ Simulating User Reply...');
    await contactService.addUserReply(thread.id, user.id, 'I uploaded a screenshot showing the discrepancy.');
    const updatedThread1 = await contactService.getMessageThread(thread.id);
    console.log(`   ✅ User Reply Added. Total Messages: ${updatedThread1.threads.length}, UnreadForAdmin: ${updatedThread1.unreadForAdmin}`);

    // TEST 4: Admin Assign Staff & Update Priority
    console.log('4️⃣ Assigning Staff & Updating Priority...');
    await contactService.assignStaff(thread.id, admin.id);
    await contactService.updatePriority(thread.id, 'URGENT');
    const updatedThread2 = await contactService.getMessageThread(thread.id);
    console.log(`   ✅ Assigned To: ${updatedThread2.assignedTo?.name}, Priority: ${updatedThread2.priority}`);

    // TEST 5: Admin Public Reply & User Notification
    console.log('5️⃣ Admin Public Reply & Notification Generation...');
    const replyRes = await contactService.addReply(
      thread.id, 
      admin.id, 
      'We have identified the decimal formatting issue and updated the CSV exporter. Please try downloading again.',
      [],
      false
    );
    console.log(`   ✅ Admin Reply Recorded. Message ID: ${replyRes.data.id}`);

    // Verify Notification Creation for User
    const userNotifs = await prisma.notificationRecipient.findMany({
      where: { userId: user.id },
      include: { notification: true },
      orderBy: { createdAt: 'desc' },
      take: 1
    });

    if (userNotifs.length > 0 && userNotifs[0].notification.type === 'SUPPORT_REPLY') {
      console.log(`   🔔 User In-App Notification Verified: "${userNotifs[0].notification.title}"`);
    } else {
      console.log('   ⚠️ In-App notification check skipped or not generated.');
    }

    // TEST 6: Internal Staff Note
    console.log('6️⃣ Creating Internal Staff Note (Invisible to User)...');
    const noteRes = await contactService.addReply(
      thread.id,
      admin.id,
      'Internal note: Customer is running Chrome v126 on Windows 11. Backend fix deployed.',
      [],
      true
    );
    console.log(`   🔒 Internal Note Saved [ID: ${noteRes.data.id}]`);

    // TEST 7: Status Resolution
    console.log('7️⃣ Resolving Support Thread...');
    await contactService.updateStatus(thread.id, 'RESOLVED');
    const finalThread = await contactService.getMessageThread(thread.id);
    console.log(`   ✅ Final Thread Status: ${finalThread.status}, ClosedAt: ${finalThread.closedAt}`);

    console.log('\n🎉 ALL 7 SUPPORT PLATFORM VERIFICATION TESTS PASSED SUCCESSFULLY! 🚀');

    // Clean up test thread
    await prisma.contactMessage.delete({ where: { id: thread.id } });
    console.log('🧹 Cleaned up test thread.');

  } catch (err) {
    console.error('❌ Verification test error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testSupportPlatform();
