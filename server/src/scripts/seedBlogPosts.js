const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedBlogPosts() {
  console.log('[Seed Blog Posts] Starting idempotent migration of blog articles...');

  const blogPath = path.resolve(__dirname, '../../../client/src/data/blogPosts.js');
  if (!fs.existsSync(blogPath)) {
    throw new Error(`Blog posts file not found at: ${blogPath}`);
  }

  const raw = fs.readFileSync(blogPath, 'utf8');
  const cleaned = raw.replace(/export\s+const\s+BLOG_POSTS\s*=\s*/, 'return ');
  const fn = new Function(cleaned);
  const posts = fn();

  if (!Array.isArray(posts) || posts.length === 0) {
    throw new Error('No articles found in blogPosts.js');
  }

  console.log(`[Seed Blog Posts] Loaded ${posts.length} articles from file. Processing...`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const post of posts) {
    const existing = await prisma.blogPost.findUnique({
      where: { slug: post.slug },
    });

    const data = {
      slug: post.slug,
      title: post.title,
      summary: post.summary || post.excerpt,
      excerpt: post.excerpt || post.summary,
      content: post.content,
      category: post.category,
      tags: Array.isArray(post.tags) ? post.tags : [],
      readTime: post.readTime || '8 min read',
      publishedAt: post.publishedAt ? new Date(post.publishedAt) : new Date(),
      status: post.status || 'PUBLISHED',
      featured: Boolean(post.featured),
      authorName: post.author?.name || 'Jahsmine Aninta',
      authorTitle: post.author?.title || 'Founder & Senior Architect, JAHZJOURNALS',
      authorAvatar: post.author?.avatar || '/logo-mark.png',
      coverImage: post.coverImage || null,
      altText: post.altText || null,
      keywords: post.keywords || null,
      tableOfContents: Array.isArray(post.tableOfContents) ? post.tableOfContents : [],
      contextualCta: post.contextualCta || null,
    };

    if (existing) {
      await prisma.blogPost.update({
        where: { id: existing.id },
        data,
      });
      updatedCount++;
    } else {
      await prisma.blogPost.create({
        data,
      });
      createdCount++;
    }
  }

  const totalInDb = await prisma.blogPost.count();
  console.log(`[Seed Blog Posts] Complete! Created: ${createdCount}, Updated: ${updatedCount}, Total in DB: ${totalInDb}`);

  return { createdCount, updatedCount, totalInDb };
}

if (require.main === module) {
  seedBlogPosts()
    .catch((err) => {
      console.error('[Seed Blog Posts] Migration error:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { seedBlogPosts };
