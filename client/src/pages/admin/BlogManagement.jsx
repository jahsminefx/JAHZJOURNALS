import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  BookOpen, Plus, Search, Filter, Eye, Star, Edit, Trash2,
  ExternalLink, CheckCircle, Clock, Archive, Sparkles, RefreshCw,
  AlertTriangle, FileText
} from 'lucide-react';

const BlogManagement = () => {
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState(null);
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, pages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({ open: false, article: null, loading: false });

  const fetchMetrics = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/blog/metrics');
      if (data.success) {
        setMetrics(data.metrics);
        if (data.metrics.categories) {
          setCategories(data.metrics.categories);
        }
      }
    } catch (err) {
      console.error('Failed to load blog metrics:', err);
    }
  }, []);

  const fetchArticles = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page,
        limit: 15,
        ...(search.trim() && { search: search.trim() }),
        ...(statusFilter !== 'ALL' && { status: statusFilter }),
        ...(categoryFilter !== 'ALL' && { category: categoryFilter }),
      });

      const { data } = await api.get(`/admin/blog/articles?${params}`);
      if (data.success) {
        setArticles(data.articles);
        setPagination(data.pagination);
        if (data.categories && data.categories.length > 0) {
          setCategories(data.categories);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch articles');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleStatusChange = async (articleId, newStatus) => {
    try {
      const { data } = await api.patch(`/admin/blog/articles/${articleId}/status`, { status: newStatus });
      toast.success(data.message || `Status updated to ${newStatus}`);
      fetchArticles();
      fetchMetrics();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleToggleFeatured = async (articleId, currentFeatured) => {
    try {
      const { data } = await api.patch(`/admin/blog/articles/${articleId}/featured`, { featured: !currentFeatured });
      toast.success(data.message);
      setArticles((prev) =>
        prev.map((a) => (a.id === articleId ? { ...a, featured: !currentFeatured } : a))
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle featured flag');
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal.article) return;
    try {
      setDeleteModal((prev) => ({ ...prev, loading: true }));
      const { data } = await api.delete(`/admin/blog/articles/${deleteModal.article.id}`);
      toast.success(data.message || 'Article deleted');
      setDeleteModal({ open: false, article: null, loading: false });
      fetchArticles();
      fetchMetrics();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete article');
      setDeleteModal((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="text-emerald-500" size={26} />
            Blog & Education Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Publish educational trading guides, manage SEO metadata, and optimize organic reader acquisition.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchMetrics();
              fetchArticles();
            }}
            className="p-2.5 rounded-lg border border-border bg-surface hover:bg-surface-muted text-muted-foreground hover:text-foreground transition"
            title="Refresh articles"
          >
            <RefreshCw size={16} />
          </button>
          <Link
            to="/admin/blog/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 text-gray-950 font-bold text-sm hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/10"
          >
            <Plus size={18} />
            Write New Article
          </Link>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-surface/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Articles</span>
            <FileText size={16} />
          </div>
          <div className="text-2xl font-black text-foreground">
            {metrics ? metrics.total : '—'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-emerald-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Published</span>
            <CheckCircle size={16} />
          </div>
          <div className="text-2xl font-black text-emerald-500">
            {metrics ? metrics.published : '—'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-amber-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Drafts</span>
            <Clock size={16} />
          </div>
          <div className="text-2xl font-black text-amber-500">
            {metrics ? metrics.draft : '—'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface/60 backdrop-blur-sm">
          <div className="flex items-center justify-between text-blue-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Views</span>
            <Eye size={16} />
          </div>
          <div className="text-2xl font-black text-foreground">
            {metrics ? metrics.totalViews.toLocaleString() : '—'}
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="p-4 rounded-xl border border-border bg-surface/60 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by title, category, or tag..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-surface-muted/60 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Tabs */}
            <div className="flex items-center p-1 bg-surface-muted border border-border rounded-lg text-xs font-medium">
              {['ALL', 'PUBLISHED', 'DRAFT', 'ARCHIVED'].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-md transition capitalize ${
                    statusFilter === st
                      ? 'bg-surface text-foreground font-bold shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {st.toLowerCase()}
                </button>
              ))}
            </div>

            {/* Category Dropdown */}
            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 bg-surface-muted border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="ALL">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Articles Table */}
      <div className="rounded-xl border border-border bg-surface/60 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-r-transparent" />
            <p className="text-sm">Loading articles registry...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen size={40} className="mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-bold text-foreground">No articles found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {search || statusFilter !== 'ALL' || categoryFilter !== 'ALL'
                ? 'No articles match your active filter criteria. Try clearing your search.'
                : 'Start building your trading education platform by writing your first article.'}
            </p>
            {search || statusFilter !== 'ALL' || categoryFilter !== 'ALL' ? (
              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                  setCategoryFilter('ALL');
                  setPage(1);
                }}
                className="mt-4 px-4 py-2 rounded-lg border border-border bg-surface-muted text-xs font-semibold text-foreground hover:bg-surface transition"
              >
                Clear Filters
              </button>
            ) : (
              <Link
                to="/admin/blog/new"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-gray-950 text-xs font-bold hover:bg-emerald-400 transition"
              >
                <Plus size={16} />
                Create Article
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted/80 border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Article</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Featured</th>
                  <th className="py-3.5 px-4">Views</th>
                  <th className="py-3.5 px-4">Updated</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {articles.map((article) => {
                  const isPublished = article.status === 'PUBLISHED';
                  const isDraft = article.status === 'DRAFT';

                  return (
                    <tr key={article.id} className="hover:bg-surface-muted/30 transition group">
                      {/* Title & Slug */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="flex items-start gap-3">
                          {article.coverImage ? (
                            <img
                              src={article.coverImage}
                              alt={article.altText || article.title}
                              className="h-10 w-14 object-cover rounded-md border border-border shrink-0 bg-surface-muted"
                            />
                          ) : (
                            <div className="h-10 w-14 rounded-md border border-border/80 bg-surface-muted flex items-center justify-center shrink-0 text-muted-foreground">
                              <FileText size={18} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <Link
                              to={`/admin/blog/edit/${article.id}`}
                              className="font-bold text-foreground hover:text-emerald-500 transition line-clamp-1"
                              title={article.title}
                            >
                              {article.title}
                            </Link>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5 line-clamp-1">
                              /blog/{article.slug}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold bg-surface-muted border border-border text-foreground">
                          {article.category}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <select
                          value={article.status}
                          onChange={(e) => handleStatusChange(article.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none transition ${
                            isPublished
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                              : isDraft
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                              : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                          }`}
                        >
                          <option value="PUBLISHED">Published</option>
                          <option value="DRAFT">Draft</option>
                          <option value="ARCHIVED">Archived</option>
                        </select>
                      </td>

                      {/* Featured */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleFeatured(article.id, article.featured)}
                          title={article.featured ? 'Remove from featured banner' : 'Set as featured banner'}
                          className={`p-1.5 rounded-lg border transition ${
                            article.featured
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                              : 'border-transparent text-muted-foreground/40 hover:text-foreground'
                          }`}
                        >
                          <Star size={16} fill={article.featured ? 'currentColor' : 'none'} />
                        </button>
                      </td>

                      {/* Views */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-foreground">
                        {article.views ? article.views.toLocaleString() : 0}
                      </td>

                      {/* Updated Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-muted-foreground">
                        {article.updatedAt
                          ? new Date(article.updatedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPublished ? (
                            <a
                              href={`/blog/${article.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              title="View published article"
                              className="p-1.5 text-muted-foreground hover:text-emerald-500 hover:bg-surface-muted rounded-lg transition"
                            >
                              <ExternalLink size={16} />
                            </a>
                          ) : (
                            <Link
                              to={`/admin/blog/edit/${article.id}?preview=true`}
                              title="Preview draft"
                              className="p-1.5 text-muted-foreground hover:text-amber-500 hover:bg-surface-muted rounded-lg transition"
                            >
                              <Eye size={16} />
                            </Link>
                          )}

                          <Link
                            to={`/admin/blog/edit/${article.id}`}
                            title="Edit article"
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-muted rounded-lg transition"
                          >
                            <Edit size={16} />
                          </Link>

                          <button
                            onClick={() => setDeleteModal({ open: true, article, loading: false })}
                            title="Delete article"
                            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {(page - 1) * pagination.limit + 1} to{' '}
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} articles
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 font-bold text-foreground">
                Page {page} of {pagination.pages}
              </span>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.open && deleteModal.article && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="h-12 w-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-foreground">Delete Article</h3>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to permanently delete{' '}
                <strong className="text-foreground">"{deleteModal.article.title}"</strong>?
              </p>
              <p className="text-xs text-red-400">
                This action is permanent and cannot be undone. Any bookmarks or inbound search links to{' '}
                <code className="bg-surface-muted px-1 py-0.5 rounded">/blog/{deleteModal.article.slug}</code> will result in a 404 error.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                disabled={deleteModal.loading}
                onClick={() => setDeleteModal({ open: false, article: null, loading: false })}
                className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-surface-muted transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={deleteModal.loading}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2"
              >
                {deleteModal.loading ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogManagement;
