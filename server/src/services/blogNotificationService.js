const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendPushToAll, sendPushToUser } = require('./pushNotificationService');

/**
 * Dispatches notification when a blog post is published.
 * 1. Creates an in-app Notification record.
 * 2. Attaches NotificationRecipient records for all registered users (status: UNREAD).
 * 3. Sends Web Push notification to all active devices.
 * 4. Marks notificationSent = true on the BlogPost.
 */
async function sendNewBlogPostNotification(article) {
  if (!article || !article.id || !article.slug) return null;

  try {
    const title = `📖 New Trading Guide: ${article.title}`;
    const message = article.summary || article.excerpt || `A new guide "${article.title}" is now available in the trading sanctuary.`;
    const actionUrl = `/blog/${article.slug}`;

    // 1. Create DB Notification
    const notification = await prisma.notification.create({
      data: {
        type: 'BLOG_POST',
        category: 'BLOG',
        title,
        message,
        actionUrl,
        isGlobal: true,
        senderId: article.createdBy || null,
      },
    });

    // 2. Attach all users as UNREAD recipients
    const allUsers = await prisma.user.findMany({
      where: { isDisabled: false },
      select: { id: true },
    });

    if (allUsers.length > 0) {
      await prisma.notificationRecipient.createMany({
        data: allUsers.map((u) => ({
          notificationId: notification.id,
          userId: u.id,
          status: 'UNREAD',
        })),
        skipDuplicates: true,
      });
    }

    // 3. Mark notificationSent on BlogPost
    await prisma.blogPost.updateMany({
      where: { id: article.id },
      data: { notificationSent: true },
    }).catch(() => {});

    // 4. Send Web Push to all devices asynchronously
    sendPushToAll({
      title,
      message,
      url: actionUrl,
      category: 'BLOG_POST',
      timestamp: new Date().toISOString(),
    }).then((res) => {
      console.log(`[Blog Notification] Push broadcast delivered to ${res.sent} devices for "${article.title}".`);
    }).catch((err) => {
      console.error('[Blog Notification] Web Push dispatch error:', err.message);
    });

    return notification;
  } catch (err) {
    console.error('[Blog Notification] Error creating new blog notification:', err);
    return null;
  }
}

/**
 * Marks a blog post as read for a specific user.
 * 1. Upserts BlogPostRead record.
 * 2. Marks any unread in-app NotificationRecipient records for this post as READ.
 */
async function markBlogPostRead(userId, slug) {
  if (!userId || !slug) return { success: false, message: 'Missing userId or slug' };

  try {
    const post = await prisma.blogPost.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    });

    if (!post) {
      return { success: false, message: 'Post not found' };
    }

    // Upsert user's BlogPostRead record
    const readRecord = await prisma.blogPostRead.upsert({
      where: {
        userId_blogPostId: {
          userId,
          blogPostId: post.id,
        },
      },
      create: {
        userId,
        blogPostId: post.id,
        readAt: new Date(),
      },
      update: {
        readAt: new Date(),
      },
    });

    // Mark matching NotificationRecipient records as READ
    await prisma.notificationRecipient.updateMany({
      where: {
        userId,
        status: 'UNREAD',
        notification: {
          actionUrl: {
            contains: `/blog/${slug}`,
          },
        },
      },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });

    return { success: true, readRecord };
  } catch (err) {
    console.error('[Blog Notification] Error marking post as read:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Dispatches unread reminders to users who have NOT read published blog posts.
 * "it should keep coming until the post is read"
 */
async function dispatchUnreadBlogPostReminders(options = {}) {
  const { force = false, minHoursBetweenReminders = 18 } = options;

  try {
    // 1. Fetch published blog posts
    const publishedPosts = await prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        excerpt: true,
        category: true,
        publishedAt: true,
      },
      take: 20,
    });

    if (publishedPosts.length === 0) {
      return { success: true, usersReminded: 0, notificationsSent: 0, message: 'No published posts to remind.' };
    }

    // 2. Fetch distinct users who have active push subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      select: { userId: true },
      distinct: ['userId'],
    });

    if (subscriptions.length === 0) {
      return { success: true, usersReminded: 0, notificationsSent: 0, message: 'No active push subscriptions found.' };
    }

    const userIds = subscriptions.map((s) => s.userId);
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - minHoursBetweenReminders * 60 * 60 * 1000);

    let usersReminded = 0;
    let notificationsSent = 0;

    for (const uid of userIds) {
      // Find what this user has already read
      const reads = await prisma.blogPostRead.findMany({
        where: { userId: uid },
        select: { blogPostId: true },
      });
      const readPostIds = new Set(reads.map((r) => r.blogPostId));

      // Unread posts for this user
      const unreadPosts = publishedPosts.filter((p) => !readPostIds.has(p.id));

      if (unreadPosts.length === 0) {
        // User has read all published posts!
        continue;
      }

      // Latest unread post
      const targetPost = unreadPosts[0];

      // Check if user was reminded recently for this post (unless force=true)
      if (!force) {
        const recentReminder = await prisma.blogPostReminderLog.findFirst({
          where: {
            userId: uid,
            blogPostId: targetPost.id,
            sentAt: { gte: cutoffTime },
          },
        });

        if (recentReminder) {
          continue;
        }
      }

      // Compose reminder message
      const unreadCount = unreadPosts.length;
      let title = `📖 Unread Guide: ${targetPost.title}`;
      let message = `You haven't read "${targetPost.title}" yet. Tap to read now and elevate your edge.`;

      if (unreadCount > 1) {
        title = `📖 ${unreadCount} Unread Guides on JahzJournal`;
        message = `Catch up on "${targetPost.title}" and ${unreadCount - 1} other unread playbook${unreadCount > 2 ? 's' : ''}. Tap to read!`;
      }

      const pushResult = await sendPushToUser(uid, {
        title,
        message,
        url: `/blog/${targetPost.slug}`,
        category: 'BLOG_REMINDER',
        timestamp: now.toISOString(),
      });

      if (pushResult && pushResult.sent > 0) {
        usersReminded++;
        notificationsSent += pushResult.sent;

        await prisma.blogPostReminderLog.create({
          data: {
            userId: uid,
            blogPostId: targetPost.id,
            sentAt: now,
          },
        }).catch((e) => console.warn('[Blog Reminder] Log insert warning:', e.message));
      }
    }

    console.log(`[Blog Reminder] Dispatched unread reminders to ${usersReminded} users (${notificationsSent} devices).`);
    return {
      success: true,
      usersReminded,
      notificationsSent,
      message: `Dispatched unread reminders to ${usersReminded} trader(s).`,
    };
  } catch (err) {
    console.error('[Blog Reminder] Error dispatching unread blog reminders:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendNewBlogPostNotification,
  markBlogPostRead,
  dispatchUnreadBlogPostReminders,
};
