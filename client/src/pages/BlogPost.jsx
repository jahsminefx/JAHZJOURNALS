import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Calendar, Clock, ArrowLeft, ArrowRight, BookOpen, Share2, CheckCircle2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';
import { BLOG_POSTS } from '../data/blogPosts';
import { getArticleSchema } from '../seo/schemas';

const BlogPost = () => {
  const { slug } = useParams();
  const post = BLOG_POSTS.find(p => p.slug === slug);

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const relatedPosts = BLOG_POSTS.filter(p => p.id !== post.id).slice(0, 3);
  const articleSchema = getArticleSchema(post);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title={post.title}
        description={post.summary}
        keywords={post.keywords}
        canonical={`https://jahzjournal.com/blog/${post.slug}`}
        ogImage={post.coverImage}
        ogType="article"
        schemas={[articleSchema]}
      />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs 
          customItems={[
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
            { name: post.title.slice(0, 30) + '...', path: `/blog/${post.slug}` }
          ]} 
        />

        <div className="mb-6">
          <Link to="/blog" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-emerald-400 transition-colors">
            <ArrowLeft size={14} /> Back to Blog Directory
          </Link>
        </div>

        {/* Article Main Layout Grid */}
        <div className="grid lg:grid-cols-12 gap-10 mb-16">
          {/* Main Article Content */}
          <article className="lg:col-span-8 space-y-6">
            {/* Category & Title */}
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
                {post.category}
              </span>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight leading-tight">
                {post.title}
              </h1>
            </div>

            {/* Author Meta Bar */}
            <div className="flex items-center justify-between p-4 bg-surface-muted border border-border rounded-2xl">
              <div className="flex items-center gap-3">
                <img 
                  src={post.author.avatar} 
                  alt={post.author.name}
                  className="w-10 h-10 rounded-full border border-emerald-500/30"
                />
                <div>
                  <div className="text-xs font-bold text-foreground">{post.author.name}</div>
                  <div className="text-[11px] text-muted">{post.author.title}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted font-medium">
                <span className="flex items-center gap-1"><Calendar size={13}/> {post.publishedAt}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Clock size={13}/> {post.readTime}</span>
              </div>
            </div>

            {/* Cover Image */}
            <div className="aspect-video bg-surface-muted rounded-2xl overflow-hidden border border-border shadow-xl">
              <img 
                src={post.coverImage} 
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Rendered HTML Content */}
            <div 
              className="prose dark:prose-invert max-w-none text-foreground text-sm leading-relaxed space-y-4"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Contextual Internal Link Banner */}
            <div className="p-6 bg-surface-muted border border-border rounded-2xl space-y-3">
              <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="text-emerald-500 dark:text-emerald-400" size={18} />
                Ready to Journal Your Trades with AI?
              </h4>
              <p className="text-xs text-muted">
                Put these principles into practice. Log trades, track emotions, and get automated AI reviews with JAHZJOURNALS.
              </p>
              <div className="pt-2">
                <Link 
                  to="/register"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl text-xs transition"
                >
                  Start Journaling Free <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-6">
            {/* Table of Contents Box */}
            {post.tableOfContents && post.tableOfContents.length > 0 && (
              <div className="p-5 bg-gray-850 border border-gray-750 rounded-2xl sticky top-24 shadow-lg">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                  <BookOpen size={15} className="text-emerald-400" /> Table of Contents
                </h3>
                <ul className="space-y-2 text-xs">
                  {post.tableOfContents.map(toc => (
                    <li key={toc.id}>
                      <a 
                        href={`#${toc.id}`}
                        className="text-gray-300 hover:text-emerald-400 transition-colors block py-1 font-medium"
                      >
                        {toc.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>

        {/* Related Posts Grid */}
        <div className="pt-10 border-t border-border">
          <h3 className="text-xl font-bold text-foreground mb-6">Related Trading Guides</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {relatedPosts.map(rel => (
              <Link 
                key={rel.id}
                to={`/blog/${rel.slug}`}
                className="bg-surface-muted border border-border p-5 rounded-2xl hover:border-emerald-500/40 transition-all block group"
              >
                <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">{rel.category}</span>
                <h4 className="text-sm font-bold text-foreground group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors mt-1 line-clamp-2">
                  {rel.title}
                </h4>
                <p className="text-xs text-muted mt-2 line-clamp-2">{rel.summary}</p>
              </Link>
            ))}
          </div>
        </div>

        <CTASection title="Elevate your trading discipline today." cta="Start Journaling Free" />
      </main>

      <Footer />
    </div>
  );
};

export default BlogPost;
