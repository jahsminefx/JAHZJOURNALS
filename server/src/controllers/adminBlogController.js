const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const cloudinary = require('../utils/cloudinary');
const streamifier = require('streamifier');
const { invalidateBlogCache } = require('../middleware/seoPrerenderMiddleware');
const {
  sendNewBlogPostNotification,
  dispatchUnreadBlogPostReminders,
} = require('../services/blogNotificationService');

const prisma = new PrismaClient();

const VALID_CTA_DESTINATIONS = new Set([
  '/risk-calculator',
  '/prop-firm-traders',
  '/strategies',
  '/register',
  '/mentors',
  '/pricing',
  '/contact',
  '/dashboard',
  '/accounts',
  '/rules',
]);

/**
 * Generates URL-friendly slug from text
 */
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Calculates reading time in minutes based on ~200 words per minute
 */
function calculateReadTime(content) {
  if (!content) return '1 min read';
  const cleanText = String(content).replace(/<[^>]+>/g, ' ').trim();
  const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return `${minutes} min read`;
}

/**
 * Automatically extracts Table of Contents from H2 and H3 headings
 * and ensures every heading in content has an id attribute.
 */
function processTableOfContents(content) {
  if (!content) return { tableOfContents: [], content: '' };

  const tableOfContents = [];
  const usedIds = new Set();

  // Replace headings ensuring each has a valid, unique id
  const updatedContent = content.replace(/<(h[23])(\s+[^>]*)?>(.*?)<\/\1>/gi, (match, tag, attrs = '', innerText) => {
    // Strip inner HTML tags to get pure title text
    const cleanTitle = innerText.replace(/<[^>]+>/g, '').trim();
    if (!cleanTitle) return match;

    let id = '';
    const idMatch = attrs.match(/id=["']([^"']+)["']/i);
    if (idMatch && idMatch[1]) {
      id = idMatch[1];
    } else {
      id = slugify(cleanTitle);
    }

    // Ensure uniqueness
    let finalId = id;
    let counter = 1;
    while (usedIds.has(finalId)) {
      finalId = `${id}-${counter}`;
      counter++;
    }
    usedIds.add(finalId);

    tableOfContents.push({
      id: finalId,
      title: cleanTitle,
      level: tag.toLowerCase() === 'h3' ? 3 : 2,
    });

    // Reconstruct heading tag with id
    const cleanAttrs = attrs.replace(/\s*id=["'][^"']*["']/gi, '').trim();
    const attrString = cleanAttrs ? ` ${cleanAttrs}` : '';
    return `<${tag} id="${finalId}"${attrString}>${innerText}</${tag}>`;
  });

  return { tableOfContents, content: updatedContent };
}

/**
 * Helper to upload buffer to Cloudinary or fallback to local disk
 */
function streamUpload(file, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (result) resolve(result);
      else reject(error);
    });
    streamifier.createReadStream(file.buffer).pipe(stream);
  });
}

/**
 * GET /api/admin/blog/metrics
 */
exports.getBlogMetrics = async (req, res) => {
  try {
    const [total, published, draft, archived, totalViewsResult, recentArticles] = await Promise.all([
      prisma.blogPost.count(),
      prisma.blogPost.count({ where: { status: 'PUBLISHED' } }),
      prisma.blogPost.count({ where: { status: 'DRAFT' } }),
      prisma.blogPost.count({ where: { status: 'ARCHIVED' } }),
      prisma.blogPost.aggregate({ _sum: { views: true } }),
      prisma.blogPost.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          category: true,
          status: true,
          views: true,
          updatedAt: true,
          publishedAt: true,
          featured: true,
        },
      }),
    ]);

    // Distinct categories
    const categoriesResult = await prisma.blogPost.findMany({
      select: { category: true },
      distinct: ['category'],
    });

    res.json({
      success: true,
      metrics: {
        total,
        published,
        draft,
        archived,
        totalViews: totalViewsResult._sum.views || 0,
        categoriesCount: categoriesResult.length,
        categories: categoriesResult.map((c) => c.category),
        recentArticles,
      },
    });
  } catch (error) {
    console.error('[Admin Blog] Metrics error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve blog metrics.' });
  }
};

/**
 * GET /api/admin/blog/articles
 */
exports.getArticles = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const skip = (page - 1) * limit;

    const { status, category, search, sortBy = 'updatedAt', order = 'desc' } = req.query;

    const where = {};

    if (status && status !== 'ALL') {
      where.status = String(status).toUpperCase();
    }

    if (category && category !== 'ALL') {
      where.category = String(category);
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
      ];
    }

    const validSortFields = ['updatedAt', 'publishedAt', 'title', 'views', 'createdAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'updatedAt';
    const sortOrder = order.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [total, articles, allCategories] = await Promise.all([
      prisma.blogPost.count({ where }),
      prisma.blogPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: sortOrder },
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          excerpt: true,
          category: true,
          tags: true,
          readTime: true,
          publishedAt: true,
          status: true,
          featured: true,
          authorName: true,
          authorTitle: true,
          coverImage: true,
          views: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.blogPost.findMany({
        select: { category: true },
        distinct: ['category'],
      }),
    ]);

    res.json({
      success: true,
      articles,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
      categories: allCategories.map((c) => c.category),
    });
  } catch (error) {
    console.error('[Admin Blog] Get articles error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve articles.' });
  }
};

/**
 * GET /api/admin/blog/articles/:id
 */
exports.getArticleById = async (req, res) => {
  try {
    const { id } = req.params;

    const article = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    res.json({ success: true, article });
  } catch (error) {
    console.error('[Admin Blog] Get article error:', error);
    res.status(500).json({ success: false, message: 'Failed to load article.' });
  }
};

/**
 * POST /api/admin/blog/articles
 */
exports.createArticle = async (req, res) => {
  try {
    const {
      title,
      slug: customSlug,
      summary,
      excerpt,
      content,
      category,
      tags = [],
      coverImage,
      altText,
      authorName = 'Jahsmine Aninta',
      authorTitle = 'Founder & Senior Architect, JAHZJOURNALS',
      authorAvatar = '/logo-mark.png',
      status = 'DRAFT',
      featured = false,
      contextualCta,
      keywords,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Article title is required.' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Article content cannot be empty.' });
    }

    // Auto-generate or validate slug
    let finalSlug = slugify(customSlug || title);
    if (!finalSlug) {
      finalSlug = `guide-${Date.now()}`;
    }

    // Check slug uniqueness
    const existingSlug = await prisma.blogPost.findUnique({
      where: { slug: finalSlug },
    });

    if (existingSlug) {
      return res.status(400).json({
        success: false,
        message: `The slug "${finalSlug}" is already taken. Please choose a unique slug.`,
      });
    }

    // Process TOC & Heading IDs
    const { tableOfContents, content: processedContent } = processTableOfContents(content);

    // Read time
    const readTime = calculateReadTime(processedContent);

    // Auto-fill excerpt and summary if missing
    const cleanText = processedContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const finalExcerpt = excerpt && excerpt.trim() ? excerpt.trim() : cleanText.slice(0, 160) + '...';
    const finalSummary = summary && summary.trim() ? summary.trim() : cleanText.slice(0, 200) + '...';

    // Validate Contextual CTA if provided
    let finalCta = null;
    if (contextualCta && contextualCta.enabled) {
      const destination = String(contextualCta.to || '').trim();
      if (!VALID_CTA_DESTINATIONS.has(destination)) {
        return res.status(400).json({
          success: false,
          message: `Invalid CTA destination "${destination}". Must be a verified application route.`,
        });
      }
      finalCta = {
        title: String(contextualCta.title || '').trim(),
        description: String(contextualCta.description || '').trim(),
        buttonText: String(contextualCta.buttonText || 'Learn More').trim(),
        to: destination,
      };
    }

    const finalStatus = ['PUBLISHED', 'DRAFT', 'ARCHIVED'].includes(status) ? status : 'DRAFT';

    invalidateBlogCache();
    const article = await prisma.blogPost.create({
      data: {
        title: title.trim(),
        slug: finalSlug,
        summary: finalSummary,
        excerpt: finalExcerpt,
        content: processedContent,
        category: (category && category.trim()) || 'Trading Strategy',
        tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
        readTime,
        publishedAt: finalStatus === 'PUBLISHED' ? new Date() : null,
        status: finalStatus,
        featured: Boolean(featured),
        authorName: authorName.trim(),
        authorTitle: authorTitle.trim(),
        authorAvatar: authorAvatar.trim(),
        coverImage: coverImage ? String(coverImage).trim() : null,
        altText: altText ? String(altText).trim() : null,
        keywords: keywords ? String(keywords).trim() : null,
        tableOfContents,
        contextualCta: finalCta,
        createdBy: req.user ? req.user.id : null,
      },
    });

    if (finalStatus === 'PUBLISHED') {
      sendNewBlogPostNotification(article).catch((err) => {
        console.error('[Admin Blog] Failed to dispatch new post notification:', err);
      });
    }

    res.status(201).json({
      success: true,
      message: finalStatus === 'PUBLISHED' ? 'Article published successfully!' : 'Article draft saved!',
      article,
    });
  } catch (error) {
    console.error('[Admin Blog] Create article error:', error);
    res.status(500).json({ success: false, message: 'Failed to create article.' });
  }
};

/**
 * PUT /api/admin/blog/articles/:id
 */
exports.updateArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      slug: customSlug,
      summary,
      excerpt,
      content,
      category,
      tags,
      coverImage,
      altText,
      authorName,
      authorTitle,
      authorAvatar,
      status,
      featured,
      contextualCta,
      keywords,
    } = req.body;

    const currentArticle = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!currentArticle) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    const updateData = {};

    if (title && title.trim()) updateData.title = title.trim();

    // Slug management
    if (customSlug && customSlug.trim() && customSlug.trim() !== currentArticle.slug) {
      const newSlug = slugify(customSlug);
      const existing = await prisma.blogPost.findUnique({
        where: { slug: newSlug },
      });
      if (existing && existing.id !== id) {
        return res.status(400).json({
          success: false,
          message: `The slug "${newSlug}" is already taken by another article.`,
        });
      }
      updateData.slug = newSlug;
    }

    // Content & TOC processing
    if (content !== undefined) {
      const { tableOfContents, content: processedContent } = processTableOfContents(content);
      updateData.content = processedContent;
      updateData.tableOfContents = tableOfContents;
      updateData.readTime = calculateReadTime(processedContent);
    }

    if (summary !== undefined) updateData.summary = String(summary).trim();
    if (excerpt !== undefined) updateData.excerpt = String(excerpt).trim();
    if (category !== undefined) updateData.category = String(category).trim();
    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [];
    }

    if (coverImage !== undefined) updateData.coverImage = coverImage ? String(coverImage).trim() : null;
    if (altText !== undefined) updateData.altText = altText ? String(altText).trim() : null;
    if (authorName !== undefined) updateData.authorName = String(authorName).trim();
    if (authorTitle !== undefined) updateData.authorTitle = String(authorTitle).trim();
    if (authorAvatar !== undefined) updateData.authorAvatar = String(authorAvatar).trim();
    if (featured !== undefined) updateData.featured = Boolean(featured);
    if (keywords !== undefined) updateData.keywords = keywords ? String(keywords).trim() : null;

    // Status transition
    if (status && ['PUBLISHED', 'DRAFT', 'ARCHIVED'].includes(status)) {
      updateData.status = status;
      if (status === 'PUBLISHED' && !currentArticle.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    // CTA
    if (contextualCta !== undefined) {
      if (contextualCta && contextualCta.enabled) {
        const destination = String(contextualCta.to || '').trim();
        if (!VALID_CTA_DESTINATIONS.has(destination)) {
          return res.status(400).json({
            success: false,
            message: `Invalid CTA destination "${destination}".`,
          });
        }
        updateData.contextualCta = {
          title: String(contextualCta.title || '').trim(),
          description: String(contextualCta.description || '').trim(),
          buttonText: String(contextualCta.buttonText || 'Learn More').trim(),
          to: destination,
        };
      } else {
        updateData.contextualCta = null;
      }
    }

    invalidateBlogCache();
    const updated = await prisma.blogPost.update({
      where: { id },
      data: updateData,
    });

    if (
      updated.status === 'PUBLISHED' &&
      (currentArticle.status !== 'PUBLISHED' || !currentArticle.notificationSent)
    ) {
      sendNewBlogPostNotification(updated).catch((err) => {
        console.error('[Admin Blog] Failed to dispatch blog update notification:', err);
      });
    }

    res.json({
      success: true,
      message: 'Article updated successfully.',
      article: updated,
    });
  } catch (error) {
    console.error('[Admin Blog] Update article error:', error);
    res.status(500).json({ success: false, message: 'Failed to update article.' });
  }
};

/**
 * PATCH /api/admin/blog/articles/:id/status
 */
exports.updateArticleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['PUBLISHED', 'DRAFT', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid article status.' });
    }

    const article = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    const updateData = { status };
    if (status === 'PUBLISHED' && !article.publishedAt) {
      updateData.publishedAt = new Date();
    }

    const updated = await prisma.blogPost.update({
      where: { id },
      data: updateData,
    });

    if (
      status === 'PUBLISHED' &&
      (!article.notificationSent || article.status !== 'PUBLISHED')
    ) {
      sendNewBlogPostNotification(updated).catch((err) => {
        console.error('[Admin Blog] Failed to dispatch blog status notification:', err);
      });
    }

    res.json({
      success: true,
      message: `Article status updated to ${status}.`,
      article: updated,
    });
  } catch (error) {
    console.error('[Admin Blog] Status update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update article status.' });
  }
};

/**
 * PATCH /api/admin/blog/articles/:id/featured
 */
exports.toggleFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    const { featured } = req.body;

    const updated = await prisma.blogPost.update({
      where: { id },
      data: { featured: Boolean(featured) },
    });

    res.json({
      success: true,
      message: updated.featured ? 'Article marked as featured.' : 'Article removed from featured.',
      article: updated,
    });
  } catch (error) {
    console.error('[Admin Blog] Toggle featured error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle featured status.' });
  }
};

/**
 * DELETE /api/admin/blog/articles/:id
 */
exports.deleteArticle = async (req, res) => {
  try {
    const { id } = req.params;

    const article = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    invalidateBlogCache();
    await prisma.blogPost.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: `Article "${article.title}" has been permanently deleted.`,
    });
  } catch (error) {
    console.error('[Admin Blog] Delete article error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete article.' });
  }
};

/**
 * POST /api/admin/blog/upload-image
 */
exports.uploadCoverImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please select an image file to upload.' });
    }

    // If Cloudinary credentials exist, stream upload
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
      const publicId = `blog_cover_${Date.now()}`;
      const result = await streamUpload(req.file, {
        folder: 'blog_covers',
        public_id: publicId,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      });

      return res.json({
        success: true,
        url: result.secure_url || result.url,
        publicId: result.public_id,
      });
    }

    // Fallback: local disk storage
    const uploadsDir = path.resolve(__dirname, '../../../uploads/blog');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = path.extname(req.file.originalname) || '.png';
    const fileName = `cover-${Date.now()}${ext}`;
    const filePath = path.join(uploadsDir, fileName);

    fs.writeFileSync(filePath, req.file.buffer);

    const host = req.get('host');
    const protocol = req.protocol;
    const fileUrl = `${protocol}://${host}/uploads/blog/${fileName}`;

    return res.json({
      success: true,
      url: fileUrl,
      fileName,
    });
  } catch (error) {
    console.error('[Admin Blog] Image upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload cover image.' });
  }
};

/**
 * GET /api/admin/blog/preview/:id
 */
exports.previewDraft = async (req, res) => {
  try {
    const { id } = req.params;

    const article = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    res.json({ success: true, article, isDraftPreview: true });
  } catch (error) {
    console.error('[Admin Blog] Preview draft error:', error);
    res.status(500).json({ success: false, message: 'Failed to load preview.' });
  }
};

/**
 * POST /api/admin/blog/remind-unread
 * Admin-triggered on-demand dispatch of unread blog post reminders.
 */
exports.remindUnreadArticles = async (req, res) => {
  try {
    const result = await dispatchUnreadBlogPostReminders({ force: true });
    return res.json({
      success: true,
      message: result.message || 'Unread blog reminders dispatched successfully.',
      ...result,
    });
  } catch (error) {
    console.error('[Admin Blog] Remind unread error:', error);
    return res.status(500).json({ success: false, message: 'Failed to dispatch blog reminders.' });
  }
};
