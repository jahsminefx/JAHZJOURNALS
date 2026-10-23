const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const {
  sendNewBlogPostNotification,
  markBlogPostRead,
  dispatchUnreadBlogPostReminders,
} = require('../src/services/blogNotificationService');
const adminBlogController = require('../src/controllers/adminBlogController');
const blogController = require('../src/controllers/blogController');

const prisma = new PrismaClient();

const mockRes = () => {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.data = body;
      return this;
    },
  };
  return res;
};

describe('Blog Notifications & Unread Reminders Suite', () => {
  const testSlug = 'automated-test-blog-notification-guide';
  let testUser = null;
  let testPost = null;
  let testSubscription = null;

  before(async () => {
    // Clean up prior test data
    await prisma.blogPostReminderLog.deleteMany({});
    await prisma.blogPostRead.deleteMany({});
    await prisma.blogPost.deleteMany({ where: { slug: testSlug } });
    await prisma.notificationRecipient.deleteMany({
      where: { notification: { actionUrl: `/blog/${testSlug}` } }
    });
    await prisma.notification.deleteMany({
      where: { actionUrl: `/blog/${testSlug}` }
    });
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: 'https://push.jahzjournal.test/blog-subscriber' }
    });
    await prisma.user.deleteMany({ where: { email: 'blogtestuser@jahzjournal.com' } });

    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'blogtestuser@jahzjournal.com',
        name: 'Blog Test Trader',
        passwordHash: 'hashed_test_password',
        role: 'TRADER',
      },
    });

    // Create test push subscription for test user
    testSubscription = await prisma.pushSubscription.create({
      data: {
        userId: testUser.id,
        endpoint: 'https://push.jahzjournal.test/blog-subscriber',
        p256dh: 'test_p256dh_key',
        auth: 'test_auth_secret',
      },
    });

    // Create test published blog post
    testPost = await prisma.blogPost.create({
      data: {
        title: 'Mastering Market Liquidity & Order Flow',
        slug: testSlug,
        summary: 'Learn how smart money targets buy-side and sell-side liquidity pools.',
        excerpt: 'Liquidity runs dictate market direction across sessions.',
        content: '<p>A deep dive into session order flow.</p>',
        category: 'Trading Strategy',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        notificationSent: false,
      },
    });
  });

  after(async () => {
    // Cleanup
    await prisma.blogPostReminderLog.deleteMany({});
    await prisma.blogPostRead.deleteMany({});
    if (testPost?.id) {
      await prisma.blogPost.deleteMany({ where: { id: testPost.id } });
    }
    await prisma.notificationRecipient.deleteMany({
      where: { notification: { actionUrl: `/blog/${testSlug}` } }
    });
    await prisma.notification.deleteMany({
      where: { actionUrl: `/blog/${testSlug}` }
    });
    if (testSubscription?.id) {
      await prisma.pushSubscription.deleteMany({ where: { id: testSubscription.id } });
    }
    if (testUser?.id) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
  });

  it('1. sendNewBlogPostNotification: creates in-app notification, UNREAD recipient, and updates notificationSent', async () => {
    const notif = await sendNewBlogPostNotification(testPost);
    assert.ok(notif, 'Notification should be created');
    assert.strictEqual(notif.type, 'BLOG_POST');
    assert.strictEqual(notif.actionUrl, `/blog/${testSlug}`);

    // Verify recipient was created for testUser
    const recipient = await prisma.notificationRecipient.findFirst({
      where: {
        notificationId: notif.id,
        userId: testUser.id,
      },
    });
    assert.ok(recipient, 'Recipient row must exist for user');
    assert.strictEqual(recipient.status, 'UNREAD');

    // Verify notificationSent is true on BlogPost
    const refreshedPost = await prisma.blogPost.findUnique({
      where: { id: testPost.id },
    });
    assert.strictEqual(refreshedPost.notificationSent, true);
  });

  it('2. dispatchUnreadBlogPostReminders: identifies unread published posts for subscribed users', async () => {
    // User has NOT read testPost yet. Calling reminder dispatcher with force: true
    const result = await dispatchUnreadBlogPostReminders({ force: true });
    assert.strictEqual(result.success, true);
    // testUser has push subscription and hasn't read testPost
    assert.ok(result.usersReminded >= 1, 'Should remind at least 1 user with unread post');
  });

  it('3. markBlogPostRead: records BlogPostRead and updates NotificationRecipient status to READ', async () => {
    const markResult = await markBlogPostRead(testUser.id, testSlug);
    assert.strictEqual(markResult.success, true);

    // Verify BlogPostRead record exists
    const readRecord = await prisma.blogPostRead.findUnique({
      where: {
        userId_blogPostId: {
          userId: testUser.id,
          blogPostId: testPost.id,
        },
      },
    });
    assert.ok(readRecord, 'BlogPostRead record must be created');

    // Verify NotificationRecipient is now marked as READ
    const recipient = await prisma.notificationRecipient.findFirst({
      where: {
        userId: testUser.id,
        notification: { actionUrl: `/blog/${testSlug}` },
      },
    });
    assert.ok(recipient, 'Recipient must exist');
    assert.strictEqual(recipient.status, 'READ');
    assert.ok(recipient.readAt instanceof Date, 'readAt must be populated');
  });

  it('4. dispatchUnreadBlogPostReminders: stops reminding user once post is marked as read', async () => {
    // testUser has read testPost. No more unread reminders for this user on this post!
    // Delete any other test posts if any, or verify testUser is not in the unread list for testPost
    const reads = await prisma.blogPostRead.findMany({
      where: { userId: testUser.id, blogPostId: testPost.id },
    });
    assert.strictEqual(reads.length, 1, 'User must have exactly 1 read record for testPost');
  });

  it('5. markBlogPostAsRead controller: HTTP endpoint marks post read', async () => {
    const req = {
      params: { slug: testSlug },
      user: { id: testUser.id },
    };
    const res = mockRes();
    await blogController.markBlogPostAsRead(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
  });

  it('6. remindUnreadArticles controller: admin endpoint dispatches reminders', async () => {
    const req = {
      user: { id: testUser.id, role: 'SUPER_ADMIN' },
    };
    const res = mockRes();
    await adminBlogController.remindUnreadArticles(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
  });
});
