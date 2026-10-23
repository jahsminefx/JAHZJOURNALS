const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { markBlogPostRead } = require('../services/blogNotificationService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/newsletter/subscribe
 * Handles public newsletter subscriptions with RFC email validation & deduplication.
 */
exports.subscribeNewsletter = async (req, res) => {
  try {
    const { email, source } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email address format.' });
    }

    // Check for existing subscription record
    const existing = await prisma.contactMessage.findFirst({
      where: {
        email: cleanEmail,
        category: 'NEWSLETTER',
      },
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        alreadySubscribed: true,
        message: 'You are already subscribed to the JAHZJOURNALS Weekly Playbook!',
      });
    }

    // Create subscription record in ContactMessage
    await prisma.contactMessage.create({
      data: {
        name: 'Newsletter Subscriber',
        email: cleanEmail,
        subject: 'Weekly Forex Trading Playbook Subscription',
        message: `Subscribed via ${source || 'Blog Page'}.`,
        category: 'NEWSLETTER',
        status: 'CLOSED',
        priority: 'NORMAL',
        tags: ['NEWSLETTER', 'BLOG_SUBSCRIBER', source ? `SRC_${String(source).toUpperCase()}` : 'SRC_BLOG'],
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Thank you for subscribing! You will receive our weekly execution playbooks.',
    });
  } catch (error) {
    console.error('[Blog Controller] Newsletter subscribe error:', error);
    return res.status(500).json({ success: false, message: 'Unable to process subscription right now. Please try again.' });
  }
};

/**
 * POST /api/blog/feedback
 * Records lightweight reader feedback (Was this article helpful?).
 */
exports.submitBlogFeedback = async (req, res) => {
  try {
    const { postSlug, helpful, feedbackText } = req.body;

    if (!postSlug || typeof postSlug !== 'string') {
      return res.status(400).json({ success: false, message: 'Article slug is required.' });
    }

    if (typeof helpful !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Helpful rating must be a boolean.' });
    }

    const cleanSlug = postSlug.trim().slice(0, 120);
    const cleanFeedback = feedbackText ? String(feedbackText).trim().slice(0, 500) : '';

    await prisma.contactMessage.create({
      data: {
        name: 'Anonymous Trader',
        email: 'reader-feedback@jahzjournal.com',
        subject: `Article Feedback: ${cleanSlug} (${helpful ? 'Helpful' : 'Needs Work'})`,
        message: cleanFeedback 
          ? `Reader feedback on [${cleanSlug}]: ${cleanFeedback}` 
          : `Reader voted ${helpful ? 'HELPFUL (Thumbs Up)' : 'NOT HELPFUL (Thumbs Down)'} on article [${cleanSlug}].`,
        category: 'BLOG_FEEDBACK',
        status: 'CLOSED',
        priority: 'LOW',
        tags: [
          'BLOG_FEEDBACK',
          cleanSlug,
          helpful ? 'HELPFUL_YES' : 'HELPFUL_NO'
        ],
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Thank you for your feedback! It helps us improve our educational guides.',
    });
  } catch (error) {
    console.error('[Blog Controller] Submit feedback error:', error);
    return res.status(500).json({ success: false, message: 'Unable to record feedback right now.' });
  }
};

const fs = require('fs');
const path = require('path');

function getFallbackBlogPosts() {
  const candidatePaths = [
    path.resolve(__dirname, '../../../client/src/data/blogPosts.js'),
    path.resolve(process.cwd(), 'client/src/data/blogPosts.js'),
    path.resolve(process.cwd(), '../client/src/data/blogPosts.js'),
    path.resolve(__dirname, '../../client/src/data/blogPosts.js'),
  ];
  for (const blogPath of candidatePaths) {
    if (fs.existsSync(blogPath)) {
      try {
        const raw = fs.readFileSync(blogPath, 'utf8');
        const cleaned = raw.replace(/export\s+const\s+BLOG_POSTS\s*=\s*/, 'return ');
        const fn = new Function(cleaned);
        const posts = fn();
        if (Array.isArray(posts) && posts.length > 0) {
          return posts.map((p) => ({
            ...p,
            authorName: p.author?.name || 'Jahsmine Aninta',
            authorTitle: p.author?.title || 'Founder & Senior Architect, JAHZJOURNALS',
            authorAvatar: p.author?.avatar || '/logo-mark.png',
          }));
        }
      } catch (err) {}
    }
  }
  return [];
}

/**
 * GET /api/blog/posts
 * Public endpoint to list published articles with search and filtering.
 */
exports.getPublicBlogPosts = async (req, res) => {
  try {
    let posts = [];
    try {
      posts = await prisma.blogPost.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
      });
    } catch (dbErr) {
      console.warn('[Blog Controller] Database query failed; using fallback blogPosts.js:', dbErr.message);
      posts = getFallbackBlogPosts().filter((p) => p.status === 'PUBLISHED');
    }

    if (!posts || posts.length === 0) {
      posts = getFallbackBlogPosts().filter((p) => p.status === 'PUBLISHED');
    }

    const { category, tag, q } = req.query;

    const categoryCounts = {};
    const tagCounts = {};

    posts.forEach((p) => {
      if (p.category) {
        categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
      }
      if (Array.isArray(p.tags)) {
        p.tags.forEach((t) => {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        });
      }
    });

    let filtered = [...posts];

    if (category && category !== 'ALL') {
      filtered = filtered.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }

    if (tag) {
      const cleanTag = tag.toLowerCase().trim();
      filtered = filtered.filter((p) => (p.tags || []).some((t) => t.toLowerCase() === cleanTag));
    }

    if (q && q.trim()) {
      const query = q.toLowerCase().trim();
      filtered = filtered.filter((p) => {
        const fields = [p.title, p.summary, p.excerpt, p.category, ...(p.tags || [])]
          .map((f) => String(f || '').toLowerCase());
        return fields.some((f) => f.includes(query));
      });
    }

    res.json({
      success: true,
      posts: filtered,
      total: filtered.length,
      categories: categoryCounts,
      tags: tagCounts,
    });
  } catch (error) {
    console.error('[Blog Controller] Get public posts error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve blog posts.' });
  }
};

/**
 * GET /api/blog/posts/:slug
 * Public endpoint to fetch an individual published guide by its stable slug.
 */
exports.getPublicBlogPostBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Slug is required.' });
    }

    let post = null;
    let allPublished = [];

    try {
      [post, allPublished] = await Promise.all([
        prisma.blogPost.findFirst({
          where: { slug, status: 'PUBLISHED' },
        }),
        prisma.blogPost.findMany({
          where: { status: 'PUBLISHED' },
          select: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            category: true,
            tags: true,
            readTime: true,
            coverImage: true,
            publishedAt: true,
          },
        }),
      ]);
    } catch (dbErr) {
      console.warn('[Blog Controller] Database query failed; using fallback:', dbErr.message);
    }

    if (!post) {
      const fallbackPosts = getFallbackBlogPosts();
      post = fallbackPosts.find((p) => p.slug === slug && p.status === 'PUBLISHED');
      allPublished = fallbackPosts.filter((p) => p.status === 'PUBLISHED');
    }

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'The requested trading guide does not exist or has been unpublished.',
      });
    }

    // Increment views asynchronously
    if (post.id) {
      prisma.blogPost.update({
        where: { id: post.id },
        data: { views: { increment: 1 } },
      }).catch((e) => console.warn('[Blog Controller] View increment warning:', e.message));
    }

    // Automatically record read if viewing as authenticated user
    if (req.user && req.user.id && post.slug) {
      markBlogPostRead(req.user.id, post.slug).catch((e) =>
        console.warn('[Blog Controller] Auto-mark read warning:', e.message)
      );
    }

    // Compute up to 3 related articles
    const relatedPosts = allPublished
      .filter((p) => p.slug !== post.slug)
      .map((p) => {
        let score = 0;
        if (p.category === post.category) score += 3;
        const sharedTags = (p.tags || []).filter((t) => (post.tags || []).includes(t));
        score += sharedTags.length;
        return { post: p, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.post);

    res.json({
      success: true,
      post,
      relatedPosts,
    });
  } catch (error) {
    console.error('[Blog Controller] Get post by slug error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve article.' });
  }
};

/**
 * POST /api/blog/posts/:slug/read
 * Explicitly marks an article as read for the authenticated user.
 */
exports.markBlogPostAsRead = async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(200).json({ success: true, message: 'Unauthenticated reader' });
    }

    const result = await markBlogPostRead(userId, slug);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('[Blog Controller] Mark post read error:', error);
    return res.status(500).json({ success: false, message: 'Failed to record read status.' });
  }
};
