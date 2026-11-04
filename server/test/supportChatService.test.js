const test = require('node:test');
const assert = require('node:assert/strict');
const contactService = require('../src/services/communications/contactService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

test('Support Chat Service & Thread Lifecycle Verification', async (t) => {
  let testUser = null;
  let testThreadId = null;

  t.before(async () => {
    // Find or create a test trader
    testUser = await prisma.user.findFirst({
      where: { role: 'TRADER' }
    });
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: `test_support_${Date.now()}@example.com`,
          name: 'Support Tester',
          passwordHash: 'dummyhash123',
          role: 'TRADER',
        }
      });
    }
  });

  t.after(async () => {
    // Clean up created test threads
    if (testThreadId) {
      await prisma.contactMessage.delete({ where: { id: testThreadId } }).catch(() => {});
    }
  });

  await t.test('1. getOrCreateUserSupportThread initializes thread with Super Admin greeting', async () => {
    const thread = await contactService.getOrCreateUserSupportThread(testUser.id);
    assert.ok(thread, 'Thread should be returned');
    assert.ok(thread.id, 'Thread should have UUID');
    assert.equal(thread.userId, testUser.id, 'Thread should belong to test user');
    assert.ok(thread.threads && thread.threads.length >= 1, 'Initial greeting should exist');
    assert.equal(thread.threads[0].senderType, 'ADMIN', 'First greeting is from Super Admin');
    testThreadId = thread.id;
  });

  await t.test('2. getOrCreateUserSupportThread returns the existing thread idempotently', async () => {
    const existing = await contactService.getOrCreateUserSupportThread(testUser.id);
    assert.equal(existing.id, testThreadId, 'Should return the same active thread ID');
  });

  await t.test('3. addUserReply creates user message and increments unreadForAdmin', async () => {
    const userMsgText = 'Hello Admin, I have a question regarding MT5 broker sync.';
    const reply = await contactService.addUserReply(testThreadId, testUser.id, userMsgText);

    assert.ok(reply, 'Reply record should be created');
    assert.equal(reply.senderType, 'USER', 'Sender type should be USER');
    assert.equal(reply.message, userMsgText);

    const updatedThread = await contactService.getMessageThread(testThreadId);
    assert.ok(updatedThread.unreadForAdmin >= 1, 'unreadForAdmin should be incremented');
  });

  await t.test('4. addReply creates admin reply and increments unreadForUser', async () => {
    // Find admin user or use system ID
    const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } }) || testUser;
    const adminMsgText = 'Hi Trader, we checked your MT5 account. It is fully connected!';

    const result = await contactService.addReply(testThreadId, admin.id, adminMsgText);
    assert.equal(result.type, 'THREAD');
    assert.equal(result.data.senderType, 'ADMIN');

    const updatedThread = await contactService.getMessageThread(testThreadId);
    assert.ok(updatedThread.unreadForUser >= 1, 'unreadForUser should be incremented');
    assert.equal(updatedThread.status, 'WAITING_FOR_USER');
  });

  await t.test('5. markThreadAsRead clears unread counters for USER and ADMIN', async () => {
    await contactService.markThreadAsRead(testThreadId, 'USER');
    let thread = await prisma.contactMessage.findUnique({ where: { id: testThreadId } });
    assert.equal(thread.unreadForUser, 0, 'unreadForUser should be cleared to 0');

    await contactService.markThreadAsRead(testThreadId, 'ADMIN');
    thread = await prisma.contactMessage.findUnique({ where: { id: testThreadId } });
    assert.equal(thread.unreadForAdmin, 0, 'unreadForAdmin should be cleared to 0');
  });
});
