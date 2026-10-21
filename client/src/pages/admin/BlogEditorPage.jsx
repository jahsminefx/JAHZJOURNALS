import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Save, Eye, Send, Upload, Image as ImageIcon,
  CheckCircle, AlertTriangle, Sparkles, Hash, Link as LinkIcon,
  Bold, Italic, List, ListOrdered, Quote, Code, Heading2, Heading3,
  X, HelpCircle, Layers, RefreshCw, ChevronDown, ChevronRight, FileCode, Check
} from 'lucide-react';
import { sanitizeArticleHtml } from '../../utils/sanitizeHtml';

const VERIFIED_ROUTES = [
  { value: '/risk-calculator', label: 'Position Size Calculator (/risk-calculator)' },
  { value: '/prop-firm-traders', label: 'Prop Firm Tracker (/prop-firm-traders)' },
  { value: '/strategies', label: 'Trading Strategies & Setups (/strategies)' },
  { value: '/register', label: 'Create Free Account (/register)' },
  { value: '/mentors', label: 'Mentor Academies & Cohorts (/mentors)' },
  { value: '/pricing', label: 'Plans & Pricing (/pricing)' },
  { value: '/contact', label: 'Trader Support & Contact (/contact)' },
];

const DEFAULT_CATEGORIES = [
  'Risk Management',
  'Prop Firm Trading',
  'Trading Psychology',
  'Trading Strategy',
  'Technical Analysis',
  'Forex Basics',
  'Fundamental Analysis',
  'AI & Innovation',
];

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const BlogEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('editor'); // 'editor', 'source', 'preview'

  // Article Form State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [originalSlug, setOriginalSlug] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [summary, setSummary] = useState('');
  const [keywords, setKeywords] = useState('');
  const [category, setCategory] = useState('Risk Management');
  const [customCategory, setCustomCategory] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [featured, setFeatured] = useState(false);
  const [coverImage, setCoverImage] = useState('');
  const [altText, setAltText] = useState('');
  const [authorName, setAuthorName] = useState('Jahsmine Aninta');
  const [authorTitle, setAuthorTitle] = useState('Founder & Senior Architect, JAHZJOURNALS');
  const [authorAvatar, setAuthorAvatar] = useState('/logo-mark.png');

  // Contextual CTA State
  const [ctaEnabled, setCtaEnabled] = useState(false);
  const [ctaTitle, setCtaTitle] = useState('');
  const [ctaDescription, setCtaDescription] = useState('');
  const [ctaButtonText, setCtaButtonText] = useState('Explore Tool');
  const [ctaDestination, setCtaDestination] = useState('/risk-calculator');

  // Image Upload State
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const visualEditorRef = useRef(null);

  // Load article if editing
  useEffect(() => {
    if (!id) return;
    const fetchArticle = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/admin/blog/articles/${id}`);
        if (data.success && data.article) {
          const a = data.article;
          setTitle(a.title || '');
          setSlug(a.slug || '');
          setOriginalSlug(a.slug || '');
          setContent(a.content || '');
          setExcerpt(a.excerpt || '');
          setSummary(a.summary || '');
          setKeywords(a.keywords || '');
          setCategory(a.category || 'Risk Management');
          setTags(Array.isArray(a.tags) ? a.tags : []);
          setStatus(a.status || 'DRAFT');
          setFeatured(Boolean(a.featured));
          setCoverImage(a.coverImage || '');
          setAltText(a.altText || '');
          setAuthorName(a.authorName || 'Jahsmine Aninta');
          setAuthorTitle(a.authorTitle || 'Founder & Senior Architect, JAHZJOURNALS');
          setAuthorAvatar(a.authorAvatar || '/logo-mark.png');

          if (a.contextualCta) {
            setCtaEnabled(true);
            setCtaTitle(a.contextualCta.title || '');
            setCtaDescription(a.contextualCta.description || '');
            setCtaButtonText(a.contextualCta.buttonText || 'Learn More');
            setCtaDestination(a.contextualCta.to || '/risk-calculator');
          }
        }
      } catch (err) {
        toast.error('Failed to load article details.');
        navigate('/admin/blog');
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [id, navigate]);

  // Sync content into visual editor on switch
  useEffect(() => {
    if (activeTab === 'editor' && visualEditorRef.current) {
      if (visualEditorRef.current.innerHTML !== content) {
        visualEditorRef.current.innerHTML = content;
      }
    }
  }, [activeTab]);

  // Derived real-time TOC
  const liveTableOfContents = useMemo(() => {
    if (!content) return [];
    const items = [];
    const regex = /<(h[23])(\s+[^>]*)?>(.*?)<\/\1>/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const tag = match[1];
      const attrs = match[2] || '';
      const text = match[3].replace(/<[^>]+>/g, '').trim();
      const idMatch = attrs.match(/id=["']([^"']+)["']/i);
      const headingId = idMatch ? idMatch[1] : slugify(text);
      if (text) {
        items.push({ id: headingId, title: text, level: tag.toLowerCase() === 'h3' ? 3 : 2 });
      }
    }
    return items;
  }, [content]);

  // Derived reading time
  const readingTime = useMemo(() => {
    const cleanText = content.replace(/<[^>]+>/g, ' ').trim();
    const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
    const minutes = Math.max(1, Math.ceil(wordCount / 200));
    return `${minutes} min read (${wordCount} words)`;
  }, [content]);

  // Visual Editor Command Executer
  const executeFormat = (command, value = null) => {
    if (activeTab !== 'editor') return;
    document.execCommand(command, false, value);
    if (visualEditorRef.current) {
      setContent(visualEditorRef.current.innerHTML);
    }
  };

  const handleVisualInput = () => {
    if (visualEditorRef.current) {
      setContent(visualEditorRef.current.innerHTML);
    }
  };

  const insertHeading = (level) => {
    if (activeTab === 'editor') {
      executeFormat('formatBlock', `<h${level}>`);
    } else {
      setContent((prev) => `${prev}\n<h${level}>New Heading</h${level}>\n<p>Enter text here...</p>\n`);
    }
  };

  const insertLeadParagraph = () => {
    const snippet = `<p class="lead">Write your engaging introductory thesis here.</p>\n`;
    if (activeTab === 'editor') {
      document.execCommand('insertHTML', false, snippet);
      handleVisualInput();
    } else {
      setContent((prev) => `${snippet}${prev}`);
    }
  };

  const insertCallout = () => {
    const snippet = `
<div class="my-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
  <p class="font-bold text-emerald-400 mb-1">Key Institutional Takeaway</p>
  <p class="text-sm">Highlight critical risk rules, setup criteria, or psychology principles here.</p>
</div>\n`;
    if (activeTab === 'editor') {
      document.execCommand('insertHTML', false, snippet);
      handleVisualInput();
    } else {
      setContent((prev) => `${prev}\n${snippet}`);
    }
  };

  const insertTable = () => {
    const snippet = `
<table class="w-full my-6 border-collapse border border-border text-sm">
  <thead>
    <tr class="bg-surface-muted">
      <th class="border border-border p-2 font-bold">Metric / Parameter</th>
      <th class="border border-border p-2 font-bold">Recommended Value</th>
      <th class="border border-border p-2 font-bold">Institutional Rule</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="border border-border p-2">Risk Per Trade</td>
      <td class="border border-border p-2">0.5% – 1.0%</td>
      <td class="border border-border p-2">Strict Stop Loss Required</td>
    </tr>
    <tr>
      <td class="border border-border p-2">Max Daily Drawdown</td>
      <td class="border border-border p-2">2.5%</td>
      <td class="border border-border p-2">Close terminal after 3 losses</td>
    </tr>
  </tbody>
</table>\n`;
    if (activeTab === 'editor') {
      document.execCommand('insertHTML', false, snippet);
      handleVisualInput();
    } else {
      setContent((prev) => `${prev}\n${snippet}`);
    }
  };

  const insertLinkPrompt = () => {
    const url = window.prompt('Enter destination URL (e.g. /risk-calculator or https://...):');
    if (!url) return;
    executeFormat('createLink', url);
  };

  // Auto-generate fields
  const handleAutoSlug = () => {
    if (!title.trim()) {
      toast.error('Please enter an article title first.');
      return;
    }
    setSlug(slugify(title));
  };

  const handleAutoExcerpt = () => {
    const cleanText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanText) {
      toast.error('Write article content first to extract an excerpt.');
      return;
    }
    setExcerpt(cleanText.slice(0, 160) + '...');
    if (!summary) {
      setSummary(cleanText.slice(0, 200) + '...');
    }
    toast.success('Excerpt generated from content.');
  };

  // Tag helpers
  const handleAddTag = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^,+|,+$/g, '');
      if (clean && !tags.includes(clean)) {
        setTags([...tags, clean]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Image Upload Handler
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WEBP, GIF).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image file must be under 5 MB.');
      return;
    }

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('image', file);

      const { data } = await api.post('/admin/blog/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (data.success && data.url) {
        setCoverImage(data.url);
        toast.success('Cover image uploaded successfully!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload cover image.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Save / Publish
  const handleSave = async (targetStatus) => {
    if (!title.trim()) {
      toast.error('Article title is required.');
      return;
    }

    if (!content.trim()) {
      toast.error('Article content cannot be empty.');
      return;
    }

    const finalSlug = slug.trim() ? slugify(slug) : slugify(title);
    const finalCategory = customCategory.trim() ? customCategory.trim() : category;

    // Check slug warning
    if (isEditing && status === 'PUBLISHED' && originalSlug && finalSlug !== originalSlug) {
      const confirmed = window.confirm(
        `Warning: You are modifying the slug of an already published article from "/blog/${originalSlug}" to "/blog/${finalSlug}". This may break external links and search results. Do you want to proceed?`
      );
      if (!confirmed) return;
    }

    const payload = {
      title: title.trim(),
      slug: finalSlug,
      content,
      excerpt: excerpt.trim() || undefined,
      summary: summary.trim() || undefined,
      category: finalCategory,
      tags,
      keywords: keywords.trim() || undefined,
      status: targetStatus || status,
      featured,
      coverImage: coverImage.trim() || undefined,
      altText: altText.trim() || undefined,
      authorName: authorName.trim(),
      authorTitle: authorTitle.trim(),
      authorAvatar: authorAvatar.trim(),
      contextualCta: ctaEnabled
        ? {
            enabled: true,
            title: ctaTitle.trim(),
            description: ctaDescription.trim(),
            buttonText: ctaButtonText.trim(),
            to: ctaDestination,
          }
        : null,
    };

    try {
      setSaving(true);
      if (isEditing) {
        const { data } = await api.put(`/admin/blog/articles/${id}`, payload);
        toast.success(data.message || 'Article saved!');
        setOriginalSlug(finalSlug);
        setStatus(payload.status);
      } else {
        const { data } = await api.post('/admin/blog/articles', payload);
        toast.success(data.message || 'Article created!');
        navigate(`/admin/blog/edit/${data.article.id}`, { replace: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save article.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-r-transparent mb-3" />
        <p className="text-sm">Loading article editor...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/blog"
            className="p-2 rounded-lg border border-border bg-surface hover:bg-surface-muted text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-foreground">
                {isEditing ? 'Edit Article' : 'Write New Article'}
              </h1>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                  status === 'PUBLISHED'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                    : status === 'DRAFT'
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                    : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                }`}
              >
                {status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {readingTime} &bull; {liveTableOfContents.length} Sections detected
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('DRAFT')}
            className="px-4 py-2 rounded-lg border border-border bg-surface hover:bg-surface-muted text-sm font-semibold text-foreground transition disabled:opacity-50 flex items-center gap-2"
          >
            <Save size={16} />
            Save Draft
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('PUBLISHED')}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-gray-950 text-sm font-bold hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/10 disabled:opacity-50 flex items-center gap-2"
          >
            <Send size={16} />
            {status === 'PUBLISHED' ? 'Update & Publish' : 'Publish Article'}
          </button>
        </div>
      </div>

      {/* Main Form Layout (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Editor & Core Content (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Title & Slug Box */}
          <div className="p-5 rounded-xl border border-border bg-surface/60 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Article Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. How to Keep a Forex Trading Journal: Complete Step-by-Step Guide"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-muted/60 border border-border rounded-lg text-lg font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  URL Slug <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAutoSlug}
                  className="text-xs text-emerald-500 hover:text-emerald-400 font-semibold flex items-center gap-1 transition"
                >
                  <Sparkles size={12} />
                  Auto-generate from title
                </button>
              </div>
              <div className="flex items-center rounded-lg border border-border bg-surface-muted/60 overflow-hidden focus-within:border-emerald-500 transition">
                <span className="px-3 py-2 text-xs font-mono text-muted-foreground border-r border-border shrink-0 bg-surface-muted">
                  /blog/
                </span>
                <input
                  type="text"
                  placeholder="how-to-keep-a-forex-trading-journal"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-3 py-2 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              {isEditing && status === 'PUBLISHED' && originalSlug && slug !== originalSlug && (
                <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  Changing the slug of a published article may break existing Google rankings and bookmarks.
                </p>
              )}
            </div>
          </div>

          {/* Rich Text Editor Box */}
          <div className="rounded-xl border border-border bg-surface/60 overflow-hidden shadow-sm">
            {/* Mode Switcher Tabs */}
            <div className="px-4 py-2.5 border-b border-border bg-surface-muted/50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('editor')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'editor'
                      ? 'bg-surface text-emerald-500 border border-border shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Visual Editor
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('source')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'source'
                      ? 'bg-surface text-emerald-500 border border-border shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileCode size={14} />
                  HTML Source
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'preview'
                      ? 'bg-surface text-emerald-500 border border-border shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Eye size={14} />
                  Live Preview
                </button>
              </div>

              <span className="text-xs text-muted-foreground font-medium">
                {readingTime}
              </span>
            </div>

            {/* Formatting Toolbar (Active in Visual Editor & Source) */}
            {activeTab !== 'preview' && (
              <div className="p-2 border-b border-border bg-surface/40 flex flex-wrap items-center gap-1 text-muted-foreground">
                <button
                  type="button"
                  onClick={() => insertHeading(2)}
                  className="p-1.5 rounded hover:bg-surface-muted hover:text-foreground transition"
                  title="Heading 2 (H2) - Auto added to TOC"
                >
                  <Heading2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => insertHeading(3)}
                  className="p-1.5 rounded hover:bg-surface-muted hover:text-foreground transition"
                  title="Heading 3 (H3) - Sub-section"
                >
                  <Heading3 size={16} />
                </button>
                <div className="h-4 w-px bg-border mx-1" />
                <button
                  type="button"
                  onClick={() => executeFormat('bold')}
                  className="p-1.5 rounded hover:bg-surface-muted hover:text-foreground transition"
                  title="Bold (Ctrl+B)"
                >
                  <Bold size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => executeFormat('italic')}
                  className="p-1.5 rounded hover:bg-surface-muted hover:text-foreground transition"
                  title="Italic (Ctrl+I)"
                >
                  <Italic size={16} />
                </button>
                <div className="h-4 w-px bg-border mx-1" />
                <button
                  type="button"
                  onClick={() => executeFormat('insertUnorderedList')}
                  className="p-1.5 rounded hover:bg-surface-muted hover:text-foreground transition"
                  title="Bullet List"
                >
                  <List size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => executeFormat('insertOrderedList')}
                  className="p-1.5 rounded hover:bg-surface-muted hover:text-foreground transition"
                  title="Numbered List"
                >
                  <ListOrdered size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => executeFormat('formatBlock', '<blockquote>')}
                  className="p-1.5 rounded hover:bg-surface-muted hover:text-foreground transition"
                  title="Blockquote"
                >
                  <Quote size={16} />
                </button>
                <div className="h-4 w-px bg-border mx-1" />
                <button
                  type="button"
                  onClick={insertLinkPrompt}
                  className="p-1.5 rounded hover:bg-surface-muted hover:text-foreground transition"
                  title="Insert Link"
                >
                  <LinkIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={insertLeadParagraph}
                  className="px-2 py-1 rounded text-xs font-bold hover:bg-surface-muted hover:text-foreground transition"
                  title="Insert Lead Introductory Paragraph"
                >
                  Lead &para;
                </button>
                <button
                  type="button"
                  onClick={insertCallout}
                  className="px-2 py-1 rounded text-xs font-bold hover:bg-surface-muted text-emerald-400 transition"
                  title="Insert Styled Callout Box"
                >
                  + Callout Box
                </button>
                <button
                  type="button"
                  onClick={insertTable}
                  className="px-2 py-1 rounded text-xs font-bold hover:bg-surface-muted hover:text-foreground transition"
                  title="Insert Semantic Table"
                >
                  + Table
                </button>
              </div>
            )}

            {/* Active Content Area */}
            <div className="p-4 min-h-[420px]">
              {activeTab === 'editor' && (
                <div
                  ref={visualEditorRef}
                  contentEditable
                  onInput={handleVisualInput}
                  className="outline-none min-h-[380px] text-foreground leading-relaxed font-sans prose prose-invert max-w-none focus:ring-0 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-white [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4 [&_a]:text-emerald-400 [&_a]:underline"
                  placeholder="Start writing your article here..."
                />
              )}

              {activeTab === 'source' && (
                <textarea
                  rows={20}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full h-full min-h-[380px] p-3 bg-surface-muted/40 font-mono text-xs text-foreground rounded-lg border border-border focus:outline-none focus:border-emerald-500"
                  placeholder="<h2>1. First Section</h2><p>Article body...</p>"
                />
              )}

              {activeTab === 'preview' && (
                <div className="max-w-3xl mx-auto space-y-6 py-4">
                  <div className="border-b border-border pb-4">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      {category}
                    </span>
                    <h1 className="text-2xl font-black text-foreground mt-1">{title || 'Untitled Article'}</h1>
                    <p className="text-xs text-muted-foreground mt-2">
                      By {authorName} &bull; {readingTime}
                    </p>
                  </div>

                  {coverImage && (
                    <img
                      src={coverImage}
                      alt={altText || title}
                      className="w-full h-64 object-cover rounded-xl border border-border"
                    />
                  )}

                  {/* Sanitized Body Render */}
                  <div
                    className="prose prose-invert max-w-none text-foreground leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-emerald-400"
                    dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(content) }}
                  />

                  {/* Live CTA Render if enabled */}
                  {ctaEnabled && (
                    <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-foreground text-sm">{ctaTitle || 'Take the Next Step'}</h4>
                        <p className="text-xs text-muted-foreground mt-1 max-w-md">
                          {ctaDescription || 'Accelerate your trading consistency with JAHZJOURNALS tools.'}
                        </p>
                      </div>
                      <span className="px-4 py-2 rounded-lg bg-emerald-500 text-gray-950 text-xs font-bold whitespace-nowrap">
                        {ctaButtonText || 'Learn More'} &rarr;
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Excerpt & SEO Snippets */}
          <div className="p-5 rounded-xl border border-border bg-surface/60 space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileCode size={16} className="text-emerald-500" />
              Excerpt & Meta Summary (SEO)
            </h3>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Listing Card Excerpt (Teaser on /blog)
                </label>
                <button
                  type="button"
                  onClick={handleAutoExcerpt}
                  className="text-xs text-emerald-500 hover:text-emerald-400 font-semibold flex items-center gap-1 transition"
                >
                  <Sparkles size={12} />
                  Auto-extract from content
                </button>
              </div>
              <textarea
                rows={2}
                placeholder="A compelling 1-2 sentence preview shown on blog cards..."
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className="w-full px-3 py-2 bg-surface-muted/60 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Search Engine Meta Description (Google snippet)
                </label>
                <span className={`text-xs ${summary.length > 165 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                  {summary.length} / 160 chars recommended
                </span>
              </div>
              <textarea
                rows={2}
                placeholder="Meta description shown in Google search results and Twitter cards..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full px-3 py-2 bg-surface-muted/60 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                SEO Keywords (comma separated)
              </label>
              <input
                type="text"
                placeholder="Forex Risk Management, Drawdown Formula, Position Sizing Calculator"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="w-full px-3 py-2 bg-surface-muted/60 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Settings & Metadata (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Status & Publication */}
          <div className="p-5 rounded-xl border border-border bg-surface/60 space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500" />
              Publishing Status
            </h3>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Visibility Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-surface-muted border border-border rounded-lg text-xs font-bold text-foreground focus:outline-none focus:border-emerald-500"
              >
                <option value="DRAFT">Draft (Hidden from public)</option>
                <option value="PUBLISHED">Published (Live on /blog)</option>
                <option value="ARCHIVED">Archived (Unlisted)</option>
              </select>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="h-4 w-4 rounded border-border text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-xs font-semibold text-foreground">
                Set as Featured Flagship Guide
              </span>
            </label>
          </div>

          {/* Category & Tags */}
          <div className="p-5 rounded-xl border border-border bg-surface/60 space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Layers size={16} className="text-emerald-500" />
              Category & Tags
            </h3>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Primary Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-surface-muted border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-emerald-500 mb-2"
              >
                {DEFAULT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="CUSTOM">+ Custom Category</option>
              </select>

              {category === 'CUSTOM' && (
                <input
                  type="text"
                  placeholder="Enter new category name..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-muted/60 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-emerald-500"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Tags (Press Enter or Comma)
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-border bg-surface-muted/60 min-h-[38px] mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface text-xs font-medium text-foreground border border-border"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-muted-foreground hover:text-red-400"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder={tags.length === 0 ? 'Type tag and press enter...' : ''}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  className="bg-transparent text-xs text-foreground outline-none flex-1 min-w-[80px]"
                />
              </div>
            </div>
          </div>

          {/* Cover Image Upload */}
          <div className="p-5 rounded-xl border border-border bg-surface/60 space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ImageIcon size={16} className="text-emerald-500" />
              Cover Image
            </h3>

            {coverImage ? (
              <div className="space-y-2">
                <div className="relative rounded-lg overflow-hidden border border-border h-36 bg-surface-muted">
                  <img
                    src={coverImage}
                    alt={altText || 'Cover preview'}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setCoverImage('')}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-red-500 text-white rounded-lg transition"
                    title="Remove image"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-emerald-500/50 rounded-xl p-6 text-center cursor-pointer transition bg-surface-muted/30 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                />
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition">
                  {uploadingImage ? <RefreshCw size={18} className="animate-spin" /> : <Upload size={18} />}
                </div>
                <p className="text-xs font-bold text-foreground">
                  {uploadingImage ? 'Uploading to cloud...' : 'Click to upload cover image'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG, WEBP up to 5 MB</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Image Alt Text (Accessibility & SEO)
              </label>
              <input
                type="text"
                placeholder="Describe image for screen readers and SEO..."
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                className="w-full px-3 py-2 bg-surface-muted/60 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Contextual CTA Box Config */}
          <div className="p-5 rounded-xl border border-border bg-surface/60 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-500" />
                Contextual Platform CTA
              </h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ctaEnabled}
                  onChange={(e) => setCtaEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-surface-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {ctaEnabled && (
              <div className="space-y-3 pt-1 border-t border-border/60">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    CTA Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Protect Your Capital with our Free Calculator"
                    value={ctaTitle}
                    onChange={(e) => setCtaTitle(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface-muted/60 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    CTA Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Short benefit explanation..."
                    value={ctaDescription}
                    onChange={(e) => setCtaDescription(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface-muted/60 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">
                      Button Label
                    </label>
                    <input
                      type="text"
                      placeholder="Calculate Lots Free"
                      value={ctaButtonText}
                      onChange={(e) => setCtaButtonText(e.target.value)}
                      className="w-full px-3 py-1.5 bg-surface-muted/60 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">
                      Destination
                    </label>
                    <select
                      value={ctaDestination}
                      onChange={(e) => setCtaDestination(e.target.value)}
                      className="w-full px-2 py-1.5 bg-surface-muted border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-emerald-500"
                    >
                      {VERIFIED_ROUTES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live Table of Contents Preview Card */}
          <div className="p-5 rounded-xl border border-border bg-surface/60 space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Hash size={16} className="text-emerald-500" />
                Live TOC Anchors ({liveTableOfContents.length})
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Every H2 & H3 tag in your article is automatically assigned an anchor ID and indexed in the Table of Contents.
            </p>

            {liveTableOfContents.length === 0 ? (
              <p className="text-xs italic text-muted-foreground/60 py-2">
                No headings detected yet. Use the H2 or H3 toolbar buttons to create article sections.
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {liveTableOfContents.map((item, idx) => (
                  <li
                    key={idx}
                    className={`text-xs flex items-center justify-between gap-2 p-1.5 rounded-md bg-surface-muted/40 ${
                      item.level === 3 ? 'ml-3 text-muted-foreground' : 'font-medium text-foreground'
                    }`}
                  >
                    <span className="truncate">{item.title}</span>
                    <code className="text-[10px] text-emerald-400 font-mono shrink-0">#{item.id}</code>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogEditorPage;
