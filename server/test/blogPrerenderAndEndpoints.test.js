const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildSeoHtml, getBlogPosts } = require('../src/middleware/seoPrerenderMiddleware');
const blogController = require('../src/controllers/blogController');

const SAMPLE_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>JAHZJOURNALS - Forex Trading Journal</title>
  <meta name="description" content="Default meta description" />
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

describe('Blog SEO Prerender Middleware Tests', () => {
  it('should load published articles from blogPosts.js', async () => {
    const posts = await getBlogPosts();
    assert.ok(Array.isArray(posts));
    assert.ok(posts.length >= 13, 'Expected at least 13 blog posts');

    for (const post of posts) {
      assert.ok(post.slug, `Post must have slug: ${JSON.stringify(post)}`);
      assert.ok(post.title, `Post ${post.slug} must have title`);
      assert.ok(post.category, `Post ${post.slug} must have category`);
      assert.ok(Array.isArray(post.tags), `Post ${post.slug} must have tags array`);
      assert.ok(post.author && post.author.name, `Post ${post.slug} must have author`);
      assert.equal(post.status, 'PUBLISHED', `Post ${post.slug} must be PUBLISHED`);
      assert.ok(post.content && post.content.length > 100, `Post ${post.slug} content too short`);
    }
  });

  it('should prerender /blog listing page with CollectionPage schema', async () => {
    const { html, isNotFound } = await buildSeoHtml(SAMPLE_INDEX_HTML, '/blog');

    assert.equal(isNotFound, false);
    assert.ok(html.includes('<title>Forex Trading Blog, Risk Management &amp; Prop Firm Guides | JAHZJOURNALS</title>'));
    assert.ok(html.includes('rel="canonical" href="https://jahzjournal.com/blog"'));
    assert.ok(html.includes('"@type":"CollectionPage"'));
    assert.ok(html.includes('How to Keep a Forex Trading Journal'));
    assert.ok(html.includes('id="root"'));
  });

  it('should prerender valid /blog/:slug with BlogPosting schema and article body', async () => {
    const slug = 'how-to-keep-a-forex-trading-journal';
    const { html, isNotFound } = await buildSeoHtml(SAMPLE_INDEX_HTML, `/blog/${slug}`);

    assert.equal(isNotFound, false);
    assert.ok(html.includes('<title>How to Keep a Forex Trading Journal: A Step-by-Step Guide for Consistent Profitability | JAHZJOURNALS</title>'));
    assert.ok(html.includes(`rel="canonical" href="https://jahzjournal.com/blog/${slug}"`));
    assert.ok(html.includes('property="og:type" content="article"'));
    assert.ok(html.includes('"@type":"BlogPosting"'));
    assert.ok(html.includes('"headline":"How to Keep a Forex Trading Journal: A Step-by-Step Guide for Consistent Profitability"'));
    assert.ok(html.includes('"publisher":{"@type":"Organization","name":"JAHZJOURNALS"'));
    assert.ok(html.includes('Why 90% of Unjournaled Traders Fail'));
  });

  it('should return isNotFound: true and 404 content for non-existent blog slug', async () => {
    const invalidSlug = 'non-existent-forex-secret-strategy-12345';
    const { html, isNotFound } = await buildSeoHtml(SAMPLE_INDEX_HTML, `/blog/${invalidSlug}`);

    assert.equal(isNotFound, true);
    assert.ok(html.includes('<title>Trading Guide Not Found | JAHZJOURNALS</title>'));
    assert.ok(html.includes('Trading Guide Not Found'));
    assert.ok(html.includes('The article you are looking for does not exist or may have been updated.'));
    assert.ok(html.includes('href="/blog"'));
  });
});

describe('Blog Reader Engagement Controller Tests', () => {
  it('subscribeNewsletter: validates required email', async () => {
    let statusCode = null;
    let jsonBody = null;

    const req = { body: {} };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
    };

    await blogController.subscribeNewsletter(req, res);
    assert.equal(statusCode, 400);
    assert.equal(jsonBody.success, false);
    assert.ok(jsonBody.message.includes('valid email'));
  });

  it('subscribeNewsletter: validates email format', async () => {
    let statusCode = null;
    let jsonBody = null;

    const req = { body: { email: 'not-an-email' } };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
    };

    await blogController.subscribeNewsletter(req, res);
    assert.equal(statusCode, 400);
    assert.equal(jsonBody.success, false);
    assert.ok(jsonBody.message.includes('Invalid email'));
  });

  it('submitBlogFeedback: validates postSlug requirement', async () => {
    let statusCode = null;
    let jsonBody = null;

    const req = { body: { helpful: true } };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
    };

    await blogController.submitBlogFeedback(req, res);
    assert.equal(statusCode, 400);
    assert.equal(jsonBody.success, false);
    assert.ok(jsonBody.message.includes('slug is required'));
  });

  it('submitBlogFeedback: validates helpful boolean requirement', async () => {
    let statusCode = null;
    let jsonBody = null;

    const req = { body: { postSlug: 'how-to-keep-a-forex-trading-journal', helpful: 'yes' } };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
    };

    await blogController.submitBlogFeedback(req, res);
    assert.equal(statusCode, 400);
    assert.equal(jsonBody.success, false);
    assert.ok(jsonBody.message.includes('must be a boolean'));
  });
});
