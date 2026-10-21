import { BLOG_POSTS } from './blogPosts.js';

/**
 * Calculates estimated reading time based on ~200 words per minute.
 */
export const calculateReadTime = (content) => {
  if (!content) return '1 min read';
  const cleanText = content.replace(/<[^>]*>/g, ' ');
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return `${minutes} min read`;
};

/**
 * Returns all published posts.
 */
export const getPublishedPosts = () => {
  return BLOG_POSTS.filter(post => post.status !== 'DRAFT');
};

/**
 * Retrieves a single post by slug.
 */
export const getPostBySlug = (slug) => {
  if (!slug) return null;
  const normalizedSlug = String(slug).trim().toLowerCase();
  return BLOG_POSTS.find(post => post.slug.toLowerCase() === normalizedSlug && post.status !== 'DRAFT') || null;
};

/**
 * Returns the primary featured post (or fallback).
 */
export const getFeaturedPost = () => {
  const published = getPublishedPosts();
  return published.find(post => post.featured) || published[0] || null;
};

/**
 * Returns categories with their published article counts.
 */
export const getCategoriesWithCounts = () => {
  const published = getPublishedPosts();
  const counts = { ALL: published.length };
  published.forEach(post => {
    if (post.category) {
      counts[post.category] = (counts[post.category] || 0) + 1;
    }
  });
  const categories = Object.keys(counts).filter(c => c !== 'ALL');
  return { categories: ['ALL', ...categories], counts };
};

/**
 * Returns all tags across published articles with their counts.
 */
export const getTagsWithCounts = () => {
  const published = getPublishedPosts();
  const counts = {};
  published.forEach(post => {
    (post.tags || []).forEach(tag => {
      counts[tag] = (counts[tag] || 0) + 1;
    });
  });
  return counts;
};

/**
 * Returns related posts based on matching category and shared tags.
 * Excludes current post and ensures no duplicates.
 */
export const getRelatedPosts = (currentPost, limit = 3) => {
  if (!currentPost) return [];
  const published = getPublishedPosts().filter(p => p.id !== currentPost.id && p.slug !== currentPost.slug);

  // Score posts by topical similarity
  const scored = published.map(post => {
    let score = 0;
    if (post.category === currentPost.category) score += 3;
    const sharedTags = (post.tags || []).filter(t => (currentPost.tags || []).includes(t));
    score += sharedTags.length * 2;
    return { post, score };
  });

  scored.sort((a, b) => b.score - a.score || b.post.publishedAt.localeCompare(a.post.publishedAt));
  return scored.slice(0, limit).map(item => item.post);
};

/**
 * Performs deep search across title, summary, excerpt, category, tags, and keywords.
 * Normalizes case, trims whitespace, and combines with category and tag filters.
 */
export const searchBlogPosts = ({ query = '', category = 'ALL', tag = '' }) => {
  const published = getPublishedPosts();
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const normalizedCategory = String(category || 'ALL').trim();
  const normalizedTag = String(tag || '').trim().toLowerCase();

  return published.filter(post => {
    // 1. Category Filter
    if (normalizedCategory !== 'ALL' && post.category !== normalizedCategory) {
      return false;
    }

    // 2. Tag Filter
    if (normalizedTag && !(post.tags || []).some(t => t.toLowerCase() === normalizedTag)) {
      return false;
    }

    // 3. Text Search Query
    if (!normalizedQuery) return true;

    const searchableFields = [
      post.title,
      post.summary,
      post.excerpt,
      post.category,
      post.keywords,
      ...(post.tags || []),
    ].map(f => String(f || '').toLowerCase());

    return searchableFields.some(field => field.includes(normalizedQuery));
  });
};

/**
 * Curated educational pathways organizing guides into logical progressions.
 */
export const getEducationalPathways = () => [
  {
    id: 'path-foundations',
    title: 'Journaling Foundations & Process',
    description: 'Master the habits, metrics, and Sunday review routine of disciplined traders.',
    badge: 'Beginner to Intermediate',
    slugs: [
      'how-to-keep-a-forex-trading-journal',
      'building-a-winning-forex-trading-plan',
      'forex-trading-sessions-guide-london-new-york-asian'
    ]
  },
  {
    id: 'path-risk',
    title: 'Risk Management & Position Sizing',
    description: 'Eliminate over-leveraging and account drawdowns with mathematical risk calculation.',
    badge: 'Essential for All Traders',
    slugs: [
      'how-to-calculate-lot-size-in-forex-and-gold',
      'risk-management-strategies',
      'multi-currency-trading-accounts-risk-management',
      'mastering-drawdown-management-forex'
    ]
  },
  {
    id: 'path-psychology',
    title: 'Trading Psychology & Discipline',
    description: 'Frameworks to stop revenge trading, conquer FOMO, and build emotional composure.',
    badge: 'Mindset Mastery',
    slugs: [
      'trading-psychology-guide',
      'automated-mt4-mt5-trade-sync-vs-manual-journaling'
    ]
  },
  {
    id: 'path-propfirm',
    title: 'Prop Firm Evaluation Mastery',
    description: 'Navigate FTMO and FundedNext daily drawdown limits and get funded.',
    badge: 'Capital Scaling',
    slugs: [
      'how-to-pass-a-prop-firm-challenge',
      'best-forex-trading-journal-software',
      'ai-for-forex-traders',
      'ict-smart-money-trading-journal'
    ]
  }
];
