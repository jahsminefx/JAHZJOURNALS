import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Search, BookOpen, Clock, Calendar, ArrowRight, Tag, 
  FilterX, Compass, CheckCircle2, Mail, Sparkles, ChevronRight 
} from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';
import api from '../utils/api';
import { 
  getPublishedPosts, 
  getFeaturedPost, 
  getCategoriesWithCounts, 
  searchBlogPosts, 
  getEducationalPathways,
  calculateReadTime 
} from '../data/blogHelpers';

const BlogList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // URL parameters synchronization
  const initialQuery = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || 'ALL';
  const initialTag = searchParams.get('tag') || '';

  const [search, setSearch] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedTag, setSelectedTag] = useState(initialTag);
  const [allPosts, setAllPosts] = useState(() => getPublishedPosts());

  // Fetch latest published articles from backend DB
  useEffect(() => {
    let isMounted = true;
    api.get('/blog/posts')
      .then(({ data }) => {
        if (isMounted && data.success && Array.isArray(data.posts) && data.posts.length > 0) {
          setAllPosts(data.posts.map((p) => ({
            ...p,
            author: {
              name: p.authorName || 'Jahsmine Aninta',
              title: p.authorTitle || 'Founder & Senior Architect, JAHZJOURNALS',
              avatar: p.authorAvatar || '/logo-mark.png',
            },
            publishedAt: p.publishedAt ? (typeof p.publishedAt === 'string' ? p.publishedAt.split('T')[0] : p.publishedAt) : '2026-08-01',
          })));
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);
  
  // Newsletter state
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [subscribedSuccess, setSubscribedSuccess] = useState(false);

  // Sync state with URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (selectedCategory !== 'ALL') params.set('category', selectedCategory);
    if (selectedTag.trim()) params.set('tag', selectedTag.trim());

    setSearchParams(params, { replace: true });
  }, [search, selectedCategory, selectedTag, setSearchParams]);

  const { categories, counts: categoryCounts } = useMemo(() => {
    const counts = {};
    const cats = new Set();
    allPosts.forEach((post) => {
      if (post.category) {
        cats.add(post.category);
        counts[post.category] = (counts[post.category] || 0) + 1;
      }
    });
    return { categories: Array.from(cats), counts };
  }, [allPosts]);

  const educationalPathways = useMemo(() => getEducationalPathways(), []);
  const featuredPost = useMemo(() => allPosts.find((p) => p.featured) || allPosts[0], [allPosts]);

  // Filtered published articles
  const filteredPosts = useMemo(() => {
    return allPosts.filter((post) => {
      if (selectedCategory !== 'ALL' && post.category !== selectedCategory) {
        return false;
      }
      if (selectedTag && !(post.tags || []).some((t) => t.toLowerCase() === selectedTag.toLowerCase())) {
        return false;
      }
      if (!search.trim()) return true;
      const query = search.toLowerCase().trim();
      const fields = [post.title, post.summary, post.excerpt, post.category, ...(post.tags || [])]
        .map((f) => String(f || '').toLowerCase());
      return fields.some((f) => f.includes(query));
    });
  }, [allPosts, search, selectedCategory, selectedTag]);

  const isFiltering = search.trim() !== '' || selectedCategory !== 'ALL' || selectedTag !== '';

  const handleResetFilters = () => {
    setSearch('');
    setSelectedCategory('ALL');
    setSelectedTag('');
  };

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) {
      return toast.error('Please enter your email address.');
    }
    setSubscribing(true);
    try {
      const res = await api.post('/newsletter/subscribe', {
        email: newsletterEmail.trim(),
        source: 'blog_index'
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Subscribed successfully!');
        setSubscribedSuccess(true);
        setNewsletterEmail('');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to subscribe right now. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <SEO
        title="Forex Trading Blog & Educational Guides | JAHZJOURNALS"
        description="Master Forex trade journaling, calculate exact lot sizes, conquer trading psychology, pass prop firm evaluations, and uncover your edge with institutional guides."
        keywords="Forex Trading Blog, Lot Size Calculator Guide, Prop Firm Challenge Blueprint, Trading Psychology Articles, ICT Trading Journal"
        canonical="https://jahzjournal.com/blog"
      />
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20">
        <Breadcrumbs customItems={[{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }]} />

        {/* Hero Header */}
        <div className="text-center py-8 sm:py-12 border-b border-border/80 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <BookOpen size={14} /> JAHZJOURNALS Academy & Knowledge Base
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight">
            Trading Knowledge, Strategy & Discipline
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted max-w-2xl mx-auto leading-relaxed">
            Actionable, math-backed guides on trade journaling, prop firm challenges, trading psychology, and AI analytics.
          </p>

          {/* Search & Filter Toolbar */}
          <div className="mt-8 flex flex-col gap-4 max-w-3xl mx-auto">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search trading guides (e.g. lot size, prop firm, psychology, ICT, drawdown)..."
                className="w-full bg-surface border border-border/80 rounded-xl pl-10 pr-10 py-3 text-xs sm:text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition shadow-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-foreground p-1"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Pills Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none w-full justify-start sm:justify-center">
              {categories.map(cat => {
                const count = categoryCounts[cat] || 0;
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setSelectedTag('');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                        : 'border border-border/80 bg-surface text-muted hover:text-foreground hover:bg-surface-muted'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`text-[10px] rounded-full px-1.5 py-0.2 ${isSelected ? 'bg-slate-900/20 text-slate-950 font-bold' : 'bg-surface-muted text-muted'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Tag Filter Indicator */}
            {selectedTag && (
              <div className="flex items-center justify-center gap-2 text-xs">
                <span className="text-muted">Filtering by tag:</span>
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-semibold text-emerald-400">
                  <Tag size={12} /> {selectedTag}
                  <button onClick={() => setSelectedTag('')} className="ml-1 hover:text-white">✕</button>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Featured Guide Banner (Shown when not actively searching) */}
        {!isFiltering && featuredPost && (
          <div className="mb-14">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-emerald-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Featured Flagship Guide</h2>
            </div>

            <article className="rounded-2xl border border-border/80 bg-surface/90 overflow-hidden shadow-sm transition hover:border-emerald-500/40 grid lg:grid-cols-12 gap-0">
              <div className="lg:col-span-6 relative aspect-video lg:aspect-auto overflow-hidden bg-surface-muted">
                <img 
                  src={featuredPost.coverImage} 
                  alt={featuredPost.altText || featuredPost.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition duration-500 hover:scale-105"
                />
                <span className="absolute top-4 left-4 rounded-full border border-emerald-500/30 bg-black/70 px-3 py-1 text-xs font-semibold text-emerald-400 backdrop-blur-md">
                  {featuredPost.category}
                </span>
              </div>

              <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1"><Calendar size={13}/> {featuredPost.publishedAt}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock size={13}/> {calculateReadTime(featuredPost.content)}</span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground hover:text-emerald-400 transition-colors">
                    <Link to={`/blog/${featuredPost.slug}`}>
                      {featuredPost.title}
                    </Link>
                  </h3>

                  <p className="text-xs sm:text-sm text-muted leading-relaxed line-clamp-3">
                    {featuredPost.summary || featuredPost.excerpt}
                  </p>
                </div>

                <div className="pt-4 border-t border-border/70 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img 
                      src={featuredPost.author.avatar} 
                      alt={featuredPost.author.name}
                      className="w-7 h-7 rounded-full border border-emerald-500/30 object-cover"
                      onError={(e) => { e.target.src = '/logo-mark.png'; }}
                    />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{featuredPost.author.name}</p>
                      <p className="text-[10px] text-muted">{featuredPost.author.title}</p>
                    </div>
                  </div>

                  <Link 
                    to={`/blog/${featuredPost.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400"
                  >
                    <span>Read Guide</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </article>
          </div>
        )}

        {/* Section Heading & Result Count */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              {isFiltering ? 'Search Results' : 'All Trading Guides'}
            </h2>
            <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-muted border border-border/80">
              {filteredPosts.length} {filteredPosts.length === 1 ? 'article' : 'articles'}
            </span>
          </div>

          {isFiltering && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
            >
              <FilterX size={13} />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Blog Post Cards Grid or No-Results State */}
        {filteredPosts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-surface/50 p-12 text-center my-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-muted mb-4 border border-border">
              <Search className="h-6 w-6 text-muted" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No articles found</h3>
            <p className="mx-auto mt-1 max-w-md text-xs sm:text-sm text-muted">
              We couldn't find any guides matching "{search || selectedCategory}". Try adjusting your keywords or clearing the category filter.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 transition"
              >
                <FilterX size={14} />
                <span>Clear All Filters</span>
              </button>
            </div>
            
            {/* Quick Suggestions */}
            <div className="mt-8 pt-6 border-t border-border/60 max-w-md mx-auto">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block mb-2">Popular Topics</span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {['Risk Management', 'Lot Size', 'Prop Firm', 'Psychology', 'ICT'].map(topic => (
                  <button
                    key={topic}
                    onClick={() => {
                      setSearch(topic);
                      setSelectedCategory('ALL');
                    }}
                    className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-muted hover:text-foreground hover:bg-surface-muted transition"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-16">
            {filteredPosts.map(post => (
              <article 
                key={post.id}
                className="bg-surface/90 border border-border/80 rounded-2xl overflow-hidden hover:border-emerald-500/40 transition-all group flex flex-col shadow-sm"
              >
                <div className="aspect-video bg-surface-muted relative overflow-hidden">
                  <img 
                    src={post.coverImage} 
                    alt={post.altText || post.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { e.target.src = '/heroes/hero-home.png'; }}
                  />
                  <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-emerald-400 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-500/30 shadow-sm">
                    {post.category}
                  </span>
                </div>

                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3 text-[11px] text-muted">
                      <span className="flex items-center gap-1"><Calendar size={12}/> {post.publishedAt}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Clock size={12}/> {calculateReadTime(post.content)}</span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug">
                      <Link to={`/blog/${post.slug}`}>
                        {post.title}
                      </Link>
                    </h3>

                    <p className="text-xs text-muted leading-relaxed line-clamp-3">
                      {post.summary || post.excerpt}
                    </p>
                  </div>

                  {/* Card Tags Preview */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {post.tags.slice(0, 3).map(tag => (
                        <button
                          key={tag}
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedTag(tag);
                          }}
                          className="rounded-md border border-border/80 bg-surface-muted px-2 py-0.5 text-[10px] text-muted hover:text-emerald-400 transition"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="pt-4 border-t border-border/70 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img 
                        src={post.author.avatar} 
                        alt={post.author.name}
                        className="w-6 h-6 rounded-full border border-emerald-500/30 object-cover"
                        onError={(e) => { e.target.src = '/logo-mark.png'; }}
                      />
                      <span className="text-xs font-medium text-foreground">{post.author.name}</span>
                    </div>

                    <Link 
                      to={`/blog/${post.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      Read <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Curated Educational Pathways Section */}
        {!isFiltering && (
          <section className="my-16 rounded-3xl border border-border/80 bg-surface/70 p-6 sm:p-10 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border/70 pb-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-400 mb-1">
                  <Compass size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wider">Curated Learning Tracks</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Educational Pathways for Forex Traders
                </h2>
              </div>
              <p className="text-xs text-muted max-w-sm">
                Follow these curated reading paths to build an institutional-grade trading system from scratch.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {educationalPathways.map((path) => (
                <div key={path.id} className="rounded-2xl border border-border/80 bg-surface p-5 space-y-3 flex flex-col justify-between">
                  <div>
                    <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      {path.badge}
                    </span>
                    <h3 className="text-base font-semibold text-foreground mt-2">{path.title}</h3>
                    <p className="text-xs text-muted leading-relaxed mt-1">{path.description}</p>
                  </div>

                  <div className="pt-3 border-t border-border/70 space-y-1.5">
                    {path.slugs.map((slug, idx) => (
                      <Link
                        key={slug}
                        to={`/blog/${slug}`}
                        className="flex items-center justify-between text-xs text-foreground/80 hover:text-emerald-400 py-1 transition group"
                      >
                        <span className="truncate pr-2">Step {idx + 1}: {slug.replace(/-/g, ' ')}</span>
                        <ChevronRight size={12} className="text-muted group-hover:text-emerald-400 shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Newsletter Subscription Card */}
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-8 sm:p-10 mb-16 text-center max-w-3xl mx-auto shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 mb-4 border border-emerald-500/20">
            <Mail size={22} />
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-foreground">
            The Disciplined Trader's Weekly Playbook
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-xs sm:text-sm text-muted leading-relaxed">
            Join 2,500+ serious currency & prop-firm traders receiving our Sunday review checklist, risk models, and behavioral psychology frameworks. No hype, no spam.
          </p>

          {subscribedSuccess ? (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-400">
              <CheckCircle2 size={16} />
              <span>You are subscribed! Look out for this Sunday's playbook.</span>
            </div>
          ) : (
            <form onSubmit={handleNewsletterSubmit} className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5 max-w-md mx-auto">
              <input
                type="email"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="trader@example.com"
                required
                className="w-full rounded-xl border border-border/80 bg-surface px-4 py-2.5 text-xs sm:text-sm text-foreground placeholder:text-muted/60 focus:border-emerald-500 focus:outline-none transition shadow-sm"
              />
              <button
                type="submit"
                disabled={subscribing}
                className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400 disabled:opacity-60 whitespace-nowrap w-full sm:w-auto"
              >
                {subscribing ? 'Subscribing...' : 'Subscribe Free'}
              </button>
            </form>
          )}
        </div>

        <CTASection title="Put these trading principles into practice with JAHZJOURNALS." cta="Start Journaling Free" />
      </main>

      <Footer />
    </div>
  );
};

export default BlogList;
