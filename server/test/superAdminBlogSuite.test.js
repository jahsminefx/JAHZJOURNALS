const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { seedBlogPosts } = require('../src/scripts/seedBlogPosts');
const adminBlogController = require('../src/controllers/adminBlogController');
const blogController = require('../src/controllers/blogController');
const { buildSeoHtml } = require('../src/middleware/seoPrerenderMiddleware');

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

describe('Super Admin Blog Management System Suite', () => {
  let createdArticleId = null;
  const testSlug = 'automated-super-admin-test-guide';

  before(async () => {
    // Ensure clean state for test slug
    await prisma.blogPost.deleteMany({
      where: { slug: testSlug },
    });
  });

  after(async () => {
    // Cleanup test data
    await prisma.blogPost.deleteMany({
      where: { slug: testSlug },
    });
    if (createdArticleId) {
      await prisma.blogPost.deleteMany({
        where: { id: createdArticleId },
      });
    }
  });

  // 1. Data & Migration Idempotency
  it('Migration & Seeding: idempotent migration seeds all articles without duplicates', async () => {
    const run1 = await seedBlogPosts();
    assert.ok(run1.totalInDb >= 13, 'Expected at least 13 articles in DB');

    const run2 = await seedBlogPosts();
    assert.equal(run2.createdCount, 0, 'Second run must not create duplicates');
    assert.equal(run2.totalInDb, run1.totalInDb, 'Total in DB must remain identical');
  });

  // 2. Metrics & Listing
  it('Admin Blog Metrics: retrieves accurate counts and summary', async () => {
    const req = {};
    const res = mockRes();

    await adminBlogController.getBlogMetrics(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.metrics.total >= 13);
    assert.ok(res.data.metrics.published >= 13);
    assert.ok(Array.isArray(res.data.metrics.categories));
  });

  it('Admin Blog Articles: paginates and filters by status', async () => {
    const req = { query: { status: 'PUBLISHED', page: '1', limit: '5' } };
    const res = mockRes();

    await adminBlogController.getArticles(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.articles.length <= 5);
    assert.ok(res.data.articles.every((a) => a.status === 'PUBLISHED'));
  });

  // 3. Article Lifecycle: Create Draft
  it('Article Lifecycle: validates required title', async () => {
    const req = { body: { content: '<p>Body without title</p>' } };
    const res = mockRes();

    await adminBlogController.createArticle(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.data.success, false);
    assert.ok(res.data.message.includes('title is required'));
  });

  it('Article Lifecycle: validates and rejects untrusted external CTA URLs', async () => {
    const req = {
      body: {
        title: 'Malicious CTA Test',
        content: '<p>Content</p>',
        contextualCta: {
          enabled: true,
          title: 'Unsafe Link',
          to: 'https://phishing-site.example.com/steal-creds',
        },
      },
    };
    const res = mockRes();

    await adminBlogController.createArticle(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.data.success, false);
    assert.ok(res.data.message.includes('Invalid CTA destination'));
  });

  it('Article Lifecycle: creates draft with auto-generated TOC and reading time', async () => {
    const req = {
      user: { id: 'admin-tester-id' },
      body: {
        title: 'Automated Super Admin Test Guide',
        slug: testSlug,
        summary: 'A test article demonstrating automated TOC and draft lifecycle.',
        content: `
          <p class="lead">Introductory test lead paragraph.</p>
          <h2>1. First Test Section</h2>
          <p>Section 1 body content with trading concepts.</p>
          <h2>2. Second Test Section</h2>
          <p>Section 2 body content with risk formula.</p>
        `,
        category: 'Risk Management',
        tags: ['Test', 'Automation', 'SuperAdmin'],
        status: 'DRAFT',
        contextualCta: {
          enabled: true,
          title: 'Calculate Risk Free',
          description: 'Try the institutional lot size calculator.',
          buttonText: 'Try Calculator',
          to: '/risk-calculator',
        },
      },
    };
    const res = mockRes();

    await adminBlogController.createArticle(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.data.success, true);
    assert.ok(res.data.article.id);
    assert.equal(res.data.article.status, 'DRAFT');
    assert.equal(res.data.article.slug, testSlug);

    // Verify auto TOC extraction
    assert.ok(Array.isArray(res.data.article.tableOfContents));
    assert.equal(res.data.article.tableOfContents.length, 2);
    assert.equal(res.data.article.tableOfContents[0].title, '1. First Test Section');
    assert.ok(res.data.article.content.includes('id="1-first-test-section"'));

    createdArticleId = res.data.article.id;
  });

  // 4. Draft Isolation: Drafts must NEVER be visible publicly
  it('Draft Isolation: public listing strictly excludes drafts', async () => {
    const req = { query: {} };
    const res = mockRes();

    await blogController.getPublicBlogPosts(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.data.posts.every((p) => p.status === 'PUBLISHED'));
    assert.ok(!res.data.posts.some((p) => p.slug === testSlug), 'Draft article must NOT appear in public listing');
  });

  it('Draft Isolation: direct public fetch of draft slug returns 404', async () => {
    const req = { params: { slug: testSlug } };
    const res = mockRes();

    await blogController.getPublicBlogPostBySlug(req, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.data.success, false);
  });

  it('Draft Isolation: SEO prerender returns isNotFound: true for draft slug', async () => {
    const sampleHtml = '<title>Default</title><meta name="description" content="" /></head><body><div id="root"></div></body>';
    const { isNotFound } = await buildSeoHtml(sampleHtml, `/blog/${testSlug}`);
    assert.equal(isNotFound, true, 'Draft article must return 404 not-found in SEO prerenderer');
  });

  // 5. Protected Draft Preview (Super Admin Only)
  it('Admin Preview: allows authorized admin to preview draft', async () => {
    const req = { params: { id: createdArticleId } };
    const res = mockRes();

    await adminBlogController.previewDraft(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.article.id, createdArticleId);
    assert.equal(res.data.isDraftPreview, true);
  });

  // 6. Publishing & Public Visibility
  it('Article Lifecycle: publishing draft makes it immediately visible publicly', async () => {
    const req = { params: { id: createdArticleId }, body: { status: 'PUBLISHED' } };
    const res = mockRes();

    await adminBlogController.updateArticleStatus(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.article.status, 'PUBLISHED');
    assert.ok(res.data.article.publishedAt);

    // Now verify public endpoint returns it
    const publicReq = { params: { slug: testSlug } };
    const publicRes = mockRes();
    await blogController.getPublicBlogPostBySlug(publicReq, publicRes);
    assert.equal(publicRes.statusCode, 200);
    assert.equal(publicRes.data.post.slug, testSlug);
    assert.equal(publicRes.data.post.title, 'Automated Super Admin Test Guide');
  });

  // 7. Cleanup & Delete Lifecycle
  it('Article Lifecycle: permanently deletes article with confirmation safeguards', async () => {
    const req = { params: { id: createdArticleId } };
    const res = mockRes();

    await adminBlogController.deleteArticle(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.success, true);

    const inDb = await prisma.blogPost.findUnique({ where: { id: createdArticleId } });
    assert.equal(inDb, null, 'Deleted article must no longer exist in database');
    createdArticleId = null;
  });
});
