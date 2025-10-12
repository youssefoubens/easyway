import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Briefcase, Edit as Edit2, Trash2, Calendar, Building2, Mail, ExternalLink, ChevronLeft, ChevronRight, Sparkles, Search, Filter, Download, Eye, X, Clock, Grid3x3, List, SortAsc, SortDesc } from 'lucide-react';
import { AddPostModal } from './AddPostModal';
import { EditPostModal } from './EditPostModal';
import { GeneratePostMessageModal } from '../ai/GeneratePostMessageModal';
import { BatchGeneratePostsModal } from '../ai/BatchGeneratePostsModal';

interface InternshipPost {
  id: string;
  company_name: string;
  position_title: string;
  description: string;
  contact_email: string | null;
  extracted_emails: string[];
  company_activity: string | null;
  industry_sector: string | null;
  deadline: string | null;
  post_url: string | null;
  created_at: string;
}

type ViewMode = 'grid' | 'list';

export function InternshipPosts() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<InternshipPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPost, setEditingPost] = useState<InternshipPost | null>(null);
  const [generatingPost, setGeneratingPost] = useState<InternshipPost | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [sortBy, setSortBy] = useState<'created_at' | 'deadline' | 'company_name' | 'position_title'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [viewingPost, setViewingPost] = useState<InternshipPost | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [industries, setIndustries] = useState<string[]>([]);

  useEffect(() => {
    fetchPosts();
    fetchIndustries();
  }, [user, currentPage, searchQuery, industryFilter, deadlineFilter, itemsPerPage, sortBy, sortOrder]);

  async function fetchIndustries() {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('internship_posts')
        .select('industry_sector')
        .eq('user_id', user.id)
        .not('industry_sector', 'is', null);

      if (error) throw error;
      
      const uniqueIndustries = Array.from(new Set(data.map(d => d.industry_sector).filter(Boolean))) as string[];
      setIndustries(uniqueIndustries.sort());
    } catch (error) {
      console.error('Error fetching industries:', error);
    }
  }

  async function fetchPosts() {
    if (!user) return;

    try {
      setLoading(true);
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from('internship_posts')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id);

      if (searchQuery.trim()) {
        query = query.or(`company_name.ilike.%${searchQuery}%,position_title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      if (industryFilter !== 'all') {
        query = query.eq('industry_sector', industryFilter);
      }

      if (deadlineFilter === 'active') {
        query = query.gte('deadline', new Date().toISOString());
      } else if (deadlineFilter === 'expired') {
        query = query.lt('deadline', new Date().toISOString());
      }

      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;
      setPosts(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const { error } = await supabase
        .from('internship_posts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      const newSelected = new Set(selectedPosts);
      newSelected.delete(id);
      setSelectedPosts(newSelected);
      
      await fetchPosts();
      
      if (viewingPost?.id === id) {
        setViewingPost(null);
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
    }
  }

  async function handleBulkDelete() {
    if (selectedPosts.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedPosts.size} post(s)?`)) return;

    try {
      const { error } = await supabase
        .from('internship_posts')
        .delete()
        .in('id', Array.from(selectedPosts));

      if (error) throw error;
      
      setSelectedPosts(new Set());
      await fetchPosts();
      alert(`Successfully deleted ${selectedPosts.size} post(s)`);
    } catch (error) {
      console.error('Error deleting posts:', error);
      alert('Failed to delete posts. Please try again.');
    }
  }

  function handleSearch(value: string) {
    setSearchQuery(value);
    setCurrentPage(1);
  }

  function handleIndustryFilter(industry: string) {
    setIndustryFilter(industry);
    setCurrentPage(1);
  }

  function handleDeadlineFilter(filter: typeof deadlineFilter) {
    setDeadlineFilter(filter);
    setCurrentPage(1);
  }

  function handleSort(column: typeof sortBy) {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  }

  function togglePostSelection(postId: string) {
    const newSelected = new Set(selectedPosts);
    if (newSelected.has(postId)) {
      newSelected.delete(postId);
    } else {
      newSelected.add(postId);
    }
    setSelectedPosts(newSelected);
  }

  function toggleSelectAll() {
    if (selectedPosts.size === posts.length && posts.length > 0) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(posts.map(p => p.id)));
    }
  }

  async function exportPosts() {
    try {
      const { data, error } = await supabase
        .from('internship_posts')
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;

      const csv = [
        ['Company', 'Position', 'Industry', 'Deadline', 'Contact Email', 'Post URL', 'Created At'].join(','),
        ...data.map(post => [
          `"${post.company_name.replace(/"/g, '""')}"`,
          `"${post.position_title.replace(/"/g, '""')}"`,
          post.industry_sector || '',
          post.deadline || '',
          post.contact_email || '',
          post.post_url || '',
          new Date(post.created_at).toLocaleString()
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `internship_posts_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting posts:', error);
      alert('Failed to export posts');
    }
  }

  function isDeadlinePassed(deadline: string | null): boolean {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  }

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const activeFiltersCount = (searchQuery ? 1 : 0) + (industryFilter !== 'all' ? 1 : 0) + (deadlineFilter !== 'all' ? 1 : 0);

  if (loading && posts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Internship Posts</h1>
          <p className="text-slate-600 mt-1">
            {totalCount} {totalCount === 1 ? 'opportunity' : 'opportunities'} saved
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {selectedPosts.size > 0 && (
            <>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors shadow-sm"
              >
                <Trash2 className="w-5 h-5" />
                Delete {selectedPosts.size}
              </button>
              <button
                onClick={() => setShowBatchModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all shadow-sm"
              >
                <Sparkles className="w-5 h-5" />
                Generate {selectedPosts.size}
              </button>
            </>
          )}
          <button
            onClick={exportPosts}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Add Post
          </button>
        </div>
      </div>

      {/* Search, Filter, and View Toggle Bar */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by company, position, or description..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors relative ${
            showFilters ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Grid View"
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="List View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-slate-900">Deadline Status</label>
              {deadlineFilter !== 'all' && (
                <button
                  onClick={() => handleDeadlineFilter('all')}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'active', 'expired'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => handleDeadlineFilter(filter)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                    deadlineFilter === filter
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {filter === 'all' ? 'All' : filter === 'active' ? 'Active' : 'Expired'}
                </button>
              ))}
            </div>
          </div>
          
          {industries.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-slate-900">Industry</label>
                {industryFilter !== 'all' && (
                  <button
                    onClick={() => handleIndustryFilter('all')}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handleIndustryFilter('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                    industryFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All
                </button>
                {industries.map((industry) => (
                  <button
                    key={industry}
                    onClick={() => handleIndustryFilter(industry)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                      industryFilter === industry
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {industry}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-slate-900 mb-3 block">Sort By</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'created_at', label: 'Date Added' },
                { value: 'deadline', label: 'Deadline' },
                { value: 'company_name', label: 'Company' },
                { value: 'position_title', label: 'Position' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSort(option.value as typeof sortBy)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                    sortBy === option.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {option.label}
                  {sortBy === option.value && (
                    sortOrder === 'asc' ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selection Bar */}
      {selectedPosts.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedPosts.size === posts.length && posts.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm font-medium text-blue-900">
                {selectedPosts.size} post{selectedPosts.size !== 1 ? 's' : ''} selected
              </p>
            </div>
            <button
              onClick={() => setSelectedPosts(new Set())}
              className="text-sm text-blue-700 hover:text-blue-800 font-medium"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Posts Grid/List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-200 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {activeFiltersCount > 0 ? 'No matching posts found' : 'No internship posts yet'}
          </h3>
          <p className="text-sm text-slate-600 mb-6">
            {activeFiltersCount > 0
              ? 'Try adjusting your search or filters'
              : 'Add your first internship opportunity to start applying'
            }
          </p>
          {activeFiltersCount > 0 ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setIndustryFilter('all');
                setDeadlineFilter('all');
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              Clear All Filters
            </button>
          ) : (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Your First Post
            </button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4'}>
          {posts.map((post) => {
            const deadlinePassed = isDeadlinePassed(post.deadline);
            
            return viewMode === 'grid' ? (
              <div
                key={post.id}
                className={`bg-white rounded-xl p-6 shadow-sm border transition-all ${
                  selectedPosts.has(post.id)
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : deadlinePassed
                    ? 'border-red-200 bg-red-50/30'
                    : 'border-slate-200 hover:shadow-md hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3 mb-4">
                  <input
                    type="checkbox"
                    checked={selectedPosts.has(post.id)}
                    onChange={() => togglePostSelection(post.id)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-12 h-12 ${deadlinePassed ? 'bg-red-100' : 'bg-blue-100'} rounded-xl flex items-center justify-center flex-shrink-0`}>
                        <Building2 className={`w-6 h-6 ${deadlinePassed ? 'text-red-600' : 'text-blue-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 text-lg mb-1 truncate">
                          {post.position_title}
                        </h3>
                        <p className="text-sm text-slate-600 truncate">{post.company_name}</p>
                      </div>
                    </div>

                    {deadlinePassed && (
                      <span className="inline-flex items-center gap-1 mb-2 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        Expired
                      </span>
                    )}

                    <p className="text-sm text-slate-700 line-clamp-3 mb-4">
                      {post.description}
                    </p>

                    <div className="space-y-2 mb-4">
                      {post.industry_sector && (
                        <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                          {post.industry_sector}
                        </span>
                      )}
                      {post.deadline && (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Calendar className="w-3.5 h-3.5" />
                          <span className={deadlinePassed ? 'text-red-600 font-medium' : ''}>
                            {new Date(post.deadline).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-slate-200">
                      <button
                        onClick={() => setViewingPost(post)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button
                        onClick={() => setGeneratingPost(post)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors text-sm font-medium"
                      >
                        <Sparkles className="w-4 h-4" />
                        Generate
                      </button>
                      <button
                        onClick={() => setEditingPost(post)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                key={post.id}
                className={`bg-white rounded-xl p-6 shadow-sm border transition-all ${
                  selectedPosts.has(post.id)
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : deadlinePassed
                    ? 'border-red-200 bg-red-50/30'
                    : 'border-slate-200 hover:shadow-md hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedPosts.has(post.id)}
                    onChange={() => togglePostSelection(post.id)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className={`w-16 h-16 ${deadlinePassed ? 'bg-red-100' : 'bg-blue-100'} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Building2 className={`w-8 h-8 ${deadlinePassed ? 'text-red-600' : 'text-blue-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 text-xl mb-1">
                          {post.position_title}
                        </h3>
                        <p className="text-slate-600">{post.company_name}</p>
                      </div>
                      <div className="flex gap-2">
                        {deadlinePassed && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium whitespace-nowrap">
                            <Clock className="w-3 h-3" />
                            Expired
                          </span>
                        )}
                        {post.industry_sector && (
                          <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium whitespace-nowrap">
                            {post.industry_sector}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-slate-700 line-clamp-2 mb-3">
                      {post.description}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                      {post.deadline && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          <span className={deadlinePassed ? 'text-red-600 font-medium' : ''}>
                            {new Date(post.deadline).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {post.contact_email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-4 h-4" />
                          <span className="truncate">{post.contact_email}</span>
                        </div>
                      )}
                      {post.extracted_emails.length > 0 && (
                        <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded font-medium">
                          {post.extracted_emails.length} email{post.extracted_emails.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewingPost(post)}
                        className="flex items-center gap-1.5 px-3 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button
                        onClick={() => setGeneratingPost(post)}
                        className="flex items-center gap-1.5 px-3 py-2 text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors text-sm font-medium"
                      >
                        <Sparkles className="w-4 h-4" />
                        Generate Message
                      </button>
                      <button
                        onClick={() => setEditingPost(post)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && posts.length > 0 && (
        <div className="bg-white rounded-xl px-6 py-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-600">
                Showing <span className="font-semibold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                <span className="font-semibold text-slate-900">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of{' '}
                <span className="font-semibold text-slate-900">{totalCount}</span> posts
              </div>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value={6}>6 per page</option>
                <option value={12}>12 per page</option>
                <option value={24}>24 per page</option>
                <option value={48}>48 per page</option>
              </select>
            </div>

            {totalPages > 1 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 rounded-lg font-medium transition-colors min-w-[40px] ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="flex items-center gap-1 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Last
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Post Modal */}
      {viewingPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setViewingPost(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-slate-900">Internship Details</h2>
              <button
                onClick={() => setViewingPost(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 ${isDeadlinePassed(viewingPost.deadline) ? 'bg-red-100' : 'bg-blue-100'} rounded-xl flex items-center justify-center`}>
                  <Building2 className={`w-8 h-8 ${isDeadlinePassed(viewingPost.deadline) ? 'text-red-600' : 'text-blue-600'}`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-slate-900">{viewingPost.position_title}</h3>
                  <p className="text-lg text-slate-600">{viewingPost.company_name}</p>
                  {isDeadlinePassed(viewingPost.deadline) && (
                    <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                      <Clock className="w-3 h-3" />
                      Deadline Passed
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Description
                </label>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {viewingPost.description}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {viewingPost.industry_sector && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Industry Sector
                    </label>
                    <span className="inline-block px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium">
                      {viewingPost.industry_sector}
                    </span>
                  </div>
                )}

                {viewingPost.company_activity && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Company Activity
                    </label>
                    <p className="text-sm text-slate-900">{viewingPost.company_activity}</p>
                  </div>
                )}

                {viewingPost.deadline && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Application Deadline
                    </label>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-600" />
                      <span className={`text-sm font-medium ${isDeadlinePassed(viewingPost.deadline) ? 'text-red-600' : 'text-slate-900'}`}>
                        {new Date(viewingPost.deadline).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                )}

                {viewingPost.contact_email && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Contact Email
                    </label>
                    <a
                      href={`mailto:${viewingPost.contact_email}`}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Mail className="w-4 h-4" />
                      {viewingPost.contact_email}
                    </a>
                  </div>
                )}
              </div>

              {viewingPost.post_url && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Original Post URL
                  </label>
                  <a
                    href={viewingPost.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium break-all"
                  >
                    <ExternalLink className="w-4 h-4 flex-shrink-0" />
                    {viewingPost.post_url}
                  </a>
                </div>
              )}

              {viewingPost.extracted_emails.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Extracted Emails ({viewingPost.extracted_emails.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {viewingPost.extracted_emails.map((email, idx) => (
                      <a
                        key={idx}
                        href={`mailto:${email}`}
                        className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors"
                      >
                        {email}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Added On
                </label>
                <p className="text-sm text-slate-900">
                  {new Date(viewingPost.created_at).toLocaleString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    setGeneratingPost(viewingPost);
                    setViewingPost(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Message
                </button>
                <button
                  onClick={() => {
                    setEditingPost(viewingPost);
                    setViewingPost(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    handleDelete(viewingPost.id);
                    setViewingPost(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={() => setViewingPost(null)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors ml-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddPostModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchPosts();
            fetchIndustries();
          }}
        />
      )}

      {editingPost && (
        <EditPostModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSuccess={() => {
            setEditingPost(null);
            fetchPosts();
            fetchIndustries();
          }}
        />
      )}

      {generatingPost && (
        <GeneratePostMessageModal
          post={generatingPost}
          onClose={() => setGeneratingPost(null)}
          onSuccess={() => {
            setGeneratingPost(null);
          }}
        />
      )}

      {showBatchModal && (
        <BatchGeneratePostsModal
          posts={posts.filter(p => selectedPosts.has(p.id))}
          onClose={() => setShowBatchModal(false)}
          onSuccess={() => {
            setShowBatchModal(false);
            setSelectedPosts(new Set());
          }}
        />
      )}
    </div>
  );
}