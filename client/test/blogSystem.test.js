import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOG_POSTS } from '../src/data/blogPosts.js';
import {
  calculateReadTime,
  getPublishedPosts,
  getPostBySlug,
  getFeaturedPost,
  getCategoriesWithCounts,
  getTagsWithCounts,
  getRelatedPosts,
  searchBlogPosts,
  getEducationalPathways,
} from '../src/data/blogHelpers.js';
import { sanitizeArticleHtml } from '../src/utils/sanitizeHtml.js';

test('Blog Data Integrity - Published articles exist with unique slugs', () => {
  assert.ok(BLOG_POSTS.length >= 13, 'Expected at least 13 blog posts');
  const slugs = BLOG_POSTS.map((p) => p.slug);
  const uniqueSlugs = new Set(slugs);
  assert.equal(uniqueSlugs.size, slugs.length, 'Every blog post slug must be unique');
});

test('Blog Data Integrity - Every article has required schema fields and valid dates', () => {
  for (const post of BLOG_POSTS) {
    assert.ok(post.id, `Post missing id: ${post.slug}`);
    assert.ok(post.title && post.title.length > 10, `Post missing valid title: ${post.slug}`);
    assert.ok(post.summary && post.summary.length > 20, `Post missing summary: ${post.slug}`);
    assert.ok(post.content && post.content.length > 100, `Post content too short or missing: ${post.slug}`);
    assert.ok(post.category, `Post missing category: ${post.slug}`);
    assert.ok(Array.isArray(post.tags) && post.tags.length > 0, `Post missing tags: ${post.slug}`);
    assert.equal(post.status, 'PUBLISHED', `Post status must be PUBLISHED: ${post.slug}`);
    assert.ok(post.author && post.author.name, `Post missing author: ${post.slug}`);
    assert.match(post.publishedAt, /^\d{4}-\d{2}-\d{2}$/, `Invalid publishedAt date format on ${post.slug}`);
    assert.match(post.updatedAt, /^\d{4}-\d{2}-\d{2}$/, `Invalid updatedAt date format on ${post.slug}`);
  }
});

test('TOC Integrity - All Table of Contents anchor IDs match real IDs in article content', () => {
  let checkedTocs = 0;
  for (const post of BLOG_POSTS) {
    if (post.tableOfContents && post.tableOfContents.length > 0) {
      for (const toc of post.tableOfContents) {
        checkedTocs++;
        const idPattern = new RegExp(`id=["']${toc.id}["']`);
        assert.ok(
          idPattern.test(post.content),
          `TOC id "${toc.id}" in article "${post.slug}" has no matching heading id in content!`
        );
      }
    }
  }
  assert.ok(checkedTocs >= 40, `Expected at least 40 TOC anchors across articles, found ${checkedTocs}`);
});

test('Reading Time Calculation - Computes ~200 words per minute accurately', () => {
  assert.equal(calculateReadTime(''), '1 min read');
  assert.equal(calculateReadTime('<p>Hello world</p>'), '1 min read');
  // 450 words should be 3 min read
  const text450 = new Array(450).fill('trade').join(' ');
  assert.equal(calculateReadTime(`<p>${text450}</p>`), '3 min read');
});

test('Search & Filtering - Case-insensitive and whitespace-normalized search', () => {
  // 1. Whitespace and case normalization
  const resultsWithSpaces = searchBlogPosts({ query: '   FoReX   ' });
  const resultsClean = searchBlogPosts({ query: 'forex' });
  assert.equal(resultsWithSpaces.length, resultsClean.length);
  assert.ok(resultsClean.length > 0, 'Search for forex should return results');

  // 2. Multi-field search (keywords & tags)
  const tagResults = searchBlogPosts({ query: 'FTMO' });
  assert.ok(tagResults.some((p) => p.slug === 'how-to-pass-a-prop-firm-challenge'));

  // 3. Category combined filter
  const riskResults = searchBlogPosts({ query: 'lot size', category: 'Risk Management' });
  assert.ok(riskResults.length >= 1);
  assert.ok(riskResults.every((p) => p.category === 'Risk Management'));

  // 4. Empty query returns all published articles
  assert.equal(searchBlogPosts({ query: '', category: 'ALL' }).length, BLOG_POSTS.length);

  // 5. Non-matching query returns empty array
  assert.equal(searchBlogPosts({ query: 'xyznotfoundquery123' }).length, 0);
});

test('Related Articles - Never recommends current article and prioritizes similarity', () => {
  const currentPost = getPostBySlug('risk-management-strategies');
  assert.ok(currentPost, 'Post must exist');

  const related = getRelatedPosts(currentPost, 3);
  assert.equal(related.length, 3);
  assert.ok(!related.some((p) => p.id === currentPost.id), 'Must not contain current post');
  assert.ok(!related.some((p) => p.slug === currentPost.slug), 'Must not contain current slug');

  // Should prioritize posts with same category 'Risk Management'
  const sameCategoryCount = related.filter((p) => p.category === currentPost.category).length;
  assert.ok(sameCategoryCount >= 1, 'Should include at least one post from same category');
});

test('Educational Pathways - All referenced article slugs exist in published posts', () => {
  const pathways = getEducationalPathways();
  assert.equal(pathways.length, 4, 'Expected 4 curated pathways');

  for (const path of pathways) {
    assert.ok(path.id && path.title && path.slugs.length > 0);
    for (const slug of path.slugs) {
      const found = getPostBySlug(slug);
      assert.ok(found, `Pathway "${path.title}" references non-existent slug "${slug}"`);
    }
  }
});

test('Security - HTML Sanitizer strips XSS payloads while preserving safe markup', () => {
  const dangerousHtml = `
    <h2>Valid Title</h2>
    <p>Safe paragraph <a href="/risk-calculator">Link</a></p>
    <script>alert("XSS")</script>
    <img src="/heroes/hero-home.png" onerror="alert(1)" alt="Clean image" />
    <a href="javascript:alert(2)">Malicious Link</a>
  `;

  const cleanHtml = sanitizeArticleHtml(dangerousHtml);
  assert.ok(!cleanHtml.includes('<script>'), 'Sanitizer must remove <script> tags');
  assert.ok(!cleanHtml.includes('onerror='), 'Sanitizer must remove onerror attributes');
  assert.ok(!cleanHtml.includes('javascript:'), 'Sanitizer must strip javascript: links');
  assert.ok(cleanHtml.includes('<h2>Valid Title</h2>'), 'Sanitizer must keep safe <h2>');
  assert.ok(cleanHtml.includes('href="/risk-calculator"'), 'Sanitizer must keep safe <a> href');
});
