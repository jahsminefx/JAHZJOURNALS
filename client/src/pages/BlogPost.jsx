import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Calendar, Clock, ArrowLeft, ArrowRight, BookOpen, Share2, 
  CheckCircle2, ThumbsUp, ThumbsDown, Copy, Check, MessageSquare, 
  ChevronDown, ChevronUp, AlertCircle, Sparkles, Tag 
} from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';
import api from '../utils/api';
import { sanitizeArticleHtml } from '../utils/sanitizeHtml';
import { getPostBySlug, getRelatedPosts, calculateReadTime } from '../data/blogHelpers';
import { getArticleSchema } from '../seo/schemas';

const BlogPost = () => {
  const { slug } = useParams();
  const staticPost = useMemo(() => getPostBySlug(slug), [slug]);
  const [post, setPost] = useState(staticPost);
  const [customRelated, setCustomRelated] = useState(null);

  useEffect(() => {
    let isMounted = true;
    api.get(`/blog/posts/${slug}`)
      .then(({ data }) => {
        if (isMounted && data.success && data.post) {
          const p = data.post;
          setPost({
            ...p,
            author: {
              name: p.authorName || 'Jahsmine Aninta',
              title: p.authorTitle || 'Founder & Senior Architect, JAHZJOURNALS',
              avatar: p.authorAvatar || '/logo-mark.png',
            },
            publishedAt: p.publishedAt ? (typeof p.publishedAt === 'string' ? p.publishedAt.split('T')[0] : p.publishedAt) : '2026-08-01',
            tableOfContents: Array.isArray(p.tableOfContents) ? p.tableOfContents : [],
          });
          if (data.relatedPosts) {
            setCustomRelated(data.relatedPosts.map((r) => ({
              ...r,
              author: {
                name: r.authorName || 'Jahsmine Aninta',
                title: r.authorTitle || 'Founder & Senior Architect, JAHZJOURNALS',
                avatar: r.authorAvatar || '/logo-mark.png',
              },
            })));
          }

          // Mark article as read to dismiss unread push/in-app reminders
          api.post(`/blog/posts/${slug}/read`).catch(() => {});
        }
      })
      .catch(() => {
        // Fallback to static post
        if (isMounted && staticPost) setPost(staticPost);
      });
    return () => { isMounted = false; };
  }, [slug, staticPost]);

  // Reading progress state
  const [scrollProgress, setScrollProgress] = useState(0);

  // Active TOC section tracking
  const [activeSectionId, setActiveSectionId] = useState('');
  const [isMobileTocOpen, setIsMobileTocOpen] = useState(false);

  // Share & Copy state
  const [copiedLink, setCopiedLink] = useState(false);

  // Article feedback state
  const [hasVoted, setHasVoted] = useState(false);
  const [votingFeedback, setVotingFeedback] = useState(false);

  // Check localStorage for prior vote on this post
  useEffect(() => {
    if (slug && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`jahz_blog_vote_${slug}`);
      if (stored) {
        setHasVoted(true);
      } else {
        setHasVoted(false);
      }
    }
  }, [slug]);

  // Scroll Progress Listener
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const currentProgress = (window.scrollY / totalHeight) * 100;
        setScrollProgress(Math.min(100, Math.max(0, currentProgress)));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // IntersectionObserver for Table of Contents Headings
  useEffect(() => {
    if (!post || !post.tableOfContents || post.tableOfContents.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSectionId(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );

    post.tableOfContents.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [post]);

  const sanitizedContent = useMemo(() => {
    return post ? sanitizeArticleHtml(post.content) : '';
  }, [post]);

  const relatedPosts = useMemo(() => {
    return post ? getRelatedPosts(post, 3) : [];
  }, [post]);

  const articleSchema = useMemo(() => {
    return post ? getArticleSchema(post) : null;
  }, [post]);

  // Native share or clipboard copy
  const handleShare = async () => {
    const url = window.location.href;
    const shareData = {
      title: post.title,
      text: post.summary || post.excerpt,
      url: url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast.success('Shared successfully!');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // User cancelled share
      }
    }

    // Fallback: Copy link to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success('Article link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error('Unable to copy link.');
    }
  };

  // Submit Feedback (Was this article helpful?)
  const handleVoteHelpful = async (helpful) => {
    if (hasVoted) return;
    setVotingFeedback(true);
    try {
      await api.post('/blog/feedback', {
        postSlug: post.slug,
        helpful,
      });
      localStorage.setItem(`jahz_blog_vote_${slug}`, helpful ? 'yes' : 'no');
      setHasVoted(true);
      toast.success('Thank you for your feedback!');
    } catch (err) {
      toast.error('Unable to record feedback right now.');
    } finally {
      setVotingFeedback(false);
    }
  };

  // 404 / Not Found State
  if (!post) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <SEO 
          title="Trading Guide Not Found | JAHZJOURNALS" 
          description="The requested Forex trading guide could not be found. Browse our complete library of trading guides and tutorials." 
        />
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted text-muted border border-border">
            <AlertCircle size={28} className="text-amber-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Trading Guide Not Found
          </h1>
          <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
            The article you are looking for does not exist, has been archived, or may have a different URL.
          </p>
          <div className="pt-2">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400"
            >
              <ArrowLeft size={14} />
              <span>Browse All Trading Guides</span>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const estimatedReadTime = calculateReadTime(post.content);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans relative">
      {/* Top Reading Progress Bar */}
      <div 
        className="fixed top-0 left-0 h-1 bg-emerald-500 z-50 transition-all duration-150"
        style={{ width: `${scrollProgress}%` }}
        role="progressbar"
        aria-valuenow={scrollProgress}
        aria-valuemin="0"
        aria-valuemax="100"
      />

      <SEO
        title={`${post.title} | JAHZJOURNALS`}
        description={post.summary || post.excerpt}
        keywords={post.keywords}
        canonical={`https://jahzjournal.com/blog/${post.slug}`}
        ogImage={post.coverImage}
        ogType="article"
        schemas={articleSchema ? [articleSchema] : []}
      />
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20">
        <Breadcrumbs 
          customItems={[
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
            { name: post.title.slice(0, 32) + '...', path: `/blog/${post.slug}` }
          ]} 
        />

        {/* Back Button & Social Share Toolbar */}
        <div className="mb-6 flex items-center justify-between gap-4 pt-2">
          <Link 
            to="/blog" 
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} /> Back to Blog Directory
          </Link>

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted transition"
            title="Share this article"
          >
            {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
            <span>{copiedLink ? 'Link Copied' : 'Share'}</span>
          </button>
        </div>

        {/* Main Layout Grid */}
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 mb-16 items-start">
          {/* Main Article Content Column */}
          <article className="lg:col-span-8 space-y-6 min-w-0">
            {/* Category & Title */}
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
                {post.category}
              </span>
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight leading-tight">
                {post.title}
              </h1>
            </div>

            {/* Author Meta Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-surface/90 border border-border/80 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3">
                <img 
                  src={post.author.avatar} 
                  alt={post.author.name}
                  className="w-10 h-10 rounded-full border border-emerald-500/30 object-cover"
                  onError={(e) => { e.target.src = '/logo-mark.png'; }}
                />
                <div>
                  <p className="text-xs font-bold text-foreground">{post.author.name}</p>
                  <p className="text-[11px] text-muted">{post.author.title}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="flex items-center gap-1"><Calendar size={13}/> {post.publishedAt}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Clock size={13}/> {estimatedReadTime}</span>
              </div>
            </div>

            {/* Cover Image */}
            <div className="aspect-video bg-surface-muted rounded-2xl overflow-hidden border border-border/80 shadow-md">
              <img 
                src={post.coverImage} 
                alt={post.altText || post.title}
                loading="eager"
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = '/heroes/hero-home.png'; }}
              />
            </div>

            {/* Mobile Collapsible Table of Contents (< lg screens) */}
            {post.tableOfContents && post.tableOfContents.length > 0 && (
              <div className="lg:hidden rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-sm">
                <button
                  type="button"
                  onClick={() => setIsMobileTocOpen(!isMobileTocOpen)}
                  className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider text-muted"
                >
                  <span className="flex items-center gap-2 text-foreground">
                    <BookOpen size={14} className="text-emerald-400" /> On This Page ({post.tableOfContents.length} sections)
                  </span>
                  {isMobileTocOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {isMobileTocOpen && (
                  <ul className="mt-3 space-y-2 pt-3 border-t border-border/70 text-xs">
                    {post.tableOfContents.map((toc) => (
                      <li key={toc.id}>
                        <a 
                          href={`#${toc.id}`}
                          onClick={() => setIsMobileTocOpen(false)}
                          className={`block py-1 font-medium transition ${
                            activeSectionId === toc.id ? 'text-emerald-400 font-bold' : 'text-muted hover:text-foreground'
                          }`}
                        >
                          {toc.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Sanitized Article HTML Content */}
            <div 
              className="prose dark:prose-invert max-w-none text-foreground text-sm sm:text-base leading-relaxed space-y-4 pt-2"
              dangerouslySetInnerHTML={{ __html: sanitizedContent }}
            />

            {/* Article Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="pt-6 border-t border-border/70">
                <span className="text-xs font-medium text-muted block mb-2">Related Topics:</span>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <Link
                      key={tag}
                      to={`/blog?tag=${encodeURIComponent(tag)}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-surface px-2.5 py-1 text-xs text-muted hover:text-emerald-400 hover:border-emerald-500/30 transition"
                    >
                      <Tag size={11} />
                      <span>{tag}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Context-Aware Conversion Box */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 sm:p-7 space-y-3 shadow-sm my-8">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="text-emerald-400" size={18} />
                {post.contextualCta?.title || 'Ready to Journal Your Trades with AI?'}
              </h3>
              <p className="text-xs sm:text-sm text-muted leading-relaxed">
                {post.contextualCta?.description || 'Put these principles into practice. Log trades, track emotions, and get automated AI reviews with JAHZJOURNALS.'}
              </p>
              <div className="pt-2">
                <Link 
                  to={post.contextualCta?.to || '/register'}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl text-xs transition shadow-sm"
                >
                  <span>{post.contextualCta?.buttonText || 'Start Journaling Free'}</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* Article Feedback Widget ("Was this article helpful?") */}
            <div className="rounded-2xl border border-border/80 bg-surface/90 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Was this guide helpful?</h4>
                <p className="text-xs text-muted mt-0.5">Your feedback helps us continuously improve our forex education.</p>
              </div>

              {hasVoted ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                  <CheckCircle2 size={14} />
                  <span>Thank you for voting!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleVoteHelpful(true)}
                    disabled={votingFeedback}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-surface px-3.5 py-1.5 text-xs font-medium text-foreground hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 transition disabled:opacity-50"
                  >
                    <ThumbsUp size={13} />
                    <span>Yes, helpful</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVoteHelpful(false)}
                    disabled={votingFeedback}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-surface px-3.5 py-1.5 text-xs font-medium text-foreground hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400 transition disabled:opacity-50"
                  >
                    <ThumbsDown size={13} />
                    <span>Could be better</span>
                  </button>
                </div>
              )}
            </div>
          </article>

          {/* Sticky Desktop Sidebar (>= lg screens) */}
          <aside className="hidden lg:block lg:col-span-4 space-y-6 sticky top-24">
            {/* Table of Contents Box */}
            {post.tableOfContents && post.tableOfContents.length > 0 && (
              <div className="p-5 bg-surface/90 border border-border/80 rounded-2xl shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                  <BookOpen size={14} className="text-emerald-400" /> Table of Contents
                </h3>
                <nav>
                  <ul className="space-y-1.5 text-xs">
                    {post.tableOfContents.map((toc) => {
                      const isActive = activeSectionId === toc.id;
                      return (
                        <li key={toc.id}>
                          <a 
                            href={`#${toc.id}`}
                            className={`block py-1.5 px-2 rounded-lg transition-colors ${
                              isActive 
                                ? 'bg-emerald-500/10 text-emerald-400 font-bold border-l-2 border-emerald-400 pl-2.5' 
                                : 'text-muted hover:text-foreground hover:bg-surface-muted'
                            }`}
                          >
                            {toc.title}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>
            )}

            {/* Quick Share Card */}
            <div className="p-5 bg-surface/90 border border-border/80 rounded-2xl shadow-sm space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted block">Share Guide</span>
              <p className="text-xs text-muted leading-relaxed">
                Know another trader studying this topic? Send them this guide.
              </p>
              <button
                type="button"
                onClick={handleShare}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition shadow-sm"
              >
                {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                <span>{copiedLink ? 'Link Copied to Clipboard' : 'Share or Copy Link'}</span>
              </button>
            </div>
          </aside>
        </div>

        {/* Related Posts Grid */}
        {relatedPosts.length > 0 && (
          <div className="pt-10 border-t border-border/80">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-foreground">Related Trading Guides</h3>
              <Link to="/blog" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                View all guides &rarr;
              </Link>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {relatedPosts.map((rel) => (
                <Link 
                  key={rel.id}
                  to={`/blog/${rel.slug}`}
                  className="bg-surface/90 border border-border/80 p-5 rounded-2xl hover:border-emerald-500/40 transition-all block group shadow-sm flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                      {rel.category}
                    </span>
                    <h4 className="text-sm font-bold text-foreground group-hover:text-emerald-400 transition-colors line-clamp-2">
                      {rel.title}
                    </h4>
                    <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                      {rel.summary || rel.excerpt}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border/70 flex items-center justify-between text-[11px] text-muted font-medium mt-4">
                    <span>{rel.publishedAt}</span>
                    <span className="text-emerald-400 font-semibold group-hover:underline">Read &rarr;</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <CTASection title="Elevate your trading discipline today." cta="Start Journaling Free" />
      </main>

      <Footer />
    </div>
  );
};

export default BlogPost;
