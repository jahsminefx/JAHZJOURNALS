import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, BookOpen, Clock, Calendar, ArrowRight, Tag } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';
import { BLOG_POSTS } from '../data/blogPosts';

const BlogList = () => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const categories = ['ALL', ...new Set(BLOG_POSTS.map(p => p.category))];

  const filteredPosts = BLOG_POSTS.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(search.toLowerCase()) || 
                          post.summary.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || post.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Blog & Trading Guides | Forex Journaling, AI Analytics & Psychology"
        description="Learn how to keep a Forex trading journal, pass prop firm challenges, control trading psychology, and discover your trading edge with AI analytics."
        keywords="Forex Trading Blog, AI Trading Guides, Prop Firm Challenge Tips, Trading Psychology Articles, Forex Journal Guide"
        canonical="https://jahzjournal.com/blog"
      />
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs customItems={[{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }]} />

        {/* Hero Header */}
        <div className="text-center py-10 border-b border-border mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">
            <BookOpen size={14} /> JAHZJOURNALS Academy & Blog
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight">
            Trading Knowledge, Strategy & Discipline
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted max-w-2xl mx-auto">
            Actionable guides on trade journaling, prop firm challenges, trading psychology, and AI analytics.
          </p>

          {/* Search & Category Filter */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-xl mx-auto">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search trading guides and topics..."
                className="w-full bg-surface-muted border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar w-full sm:w-auto">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-bold'
                      : 'bg-surface-muted text-muted hover:text-foreground hover:bg-surface-muted/80'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Blog Post Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {filteredPosts.map(post => (
            <article 
              key={post.id}
              className="bg-gray-850 border border-gray-750 rounded-2xl overflow-hidden hover:border-emerald-500/40 transition-all group flex flex-col shadow-lg shadow-black/20"
            >
              <div className="aspect-video bg-gray-900 relative overflow-hidden">
                <img 
                  src={post.coverImage} 
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-[0.9]"
                />
                <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-500/30">
                  {post.category}
                </span>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-[11px] text-gray-400 font-medium">
                    <span className="flex items-center gap-1"><Calendar size={13}/> {post.publishedAt}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock size={13}/> {post.readTime}</span>
                  </div>

                  <h2 className="text-lg font-bold text-gray-100 group-hover:text-emerald-400 transition-colors line-clamp-2">
                    <Link to={`/blog/${post.slug}`}>
                      {post.title}
                    </Link>
                  </h2>

                  <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
                    {post.summary}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-750 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img 
                      src={post.author.avatar} 
                      alt={post.author.name}
                      className="w-6 h-6 rounded-full border border-emerald-500/30"
                    />
                    <span className="text-[11px] font-semibold text-gray-300">{post.author.name}</span>
                  </div>

                  <Link 
                    to={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Read <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        <CTASection title="Put these trading principles into practice with JAHZJOURNALS." cta="Start Journaling Free" />
      </main>

      <Footer />
    </div>
  );
};

export default BlogList;
