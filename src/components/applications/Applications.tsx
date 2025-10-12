import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Send, Eye, Trash2, CheckCircle, Clock, XCircle, FileText, ChevronLeft, ChevronRight, AlertCircle, Paperclip, Search, Filter, Download, Edit } from 'lucide-react';

interface Application {
  id: string;
  recipient_email: string;
  subject: string;
  email_body: string;
  status: 'draft' | 'sent' | 'failed' | 'scheduled';
  sent_at: string | null;
  scheduled_for: string | null;
  error_message: string | null;
  created_at: string;
  post_id: string | null;
  contact_id: string | null;
}

interface Resume {
  id: string;
  file_url: string;
  user_id: string;
}

export function Applications() {
  const { user, signOut } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [filter, setFilter] = useState<'all' | 'draft' | 'sent' | 'failed' | 'scheduled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<{ message: string; needsReauth: boolean } | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [sortBy, setSortBy] = useState<'created_at' | 'sent_at' | 'recipient_email'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchApplications();
    fetchResume();
  }, [user, currentPage, filter, searchQuery, itemsPerPage, sortBy, sortOrder]);

  async function fetchResume() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('resumes')
        .select('id, file_url, user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setResume(data);
    } catch (error) {
      console.error('Error fetching resume:', error);
    }
  }

  async function fetchApplications() {
    if (!user) return;

    try {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from('applications')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id);

      // Apply status filter
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      // Apply search filter
      if (searchQuery.trim()) {
        query = query.or(`recipient_email.ilike.%${searchQuery}%,subject.ilike.%${searchQuery}%,email_body.ilike.%${searchQuery}%`);
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;
      setApplications(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this application?')) return;

    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchApplications();
      if (selectedApp?.id === id) {
        setSelectedApp(null);
      }
    } catch (error) {
      console.error('Error deleting application:', error);
      alert('Failed to delete application. Please try again.');
    }
  }

  async function handleSendEmail(app: Application) {
    if (!resume) {
      alert('Please upload your resume first in the Resume Manager before sending applications.');
      return;
    }

    if (!confirm(`Send email to ${app.recipient_email} with your resume attached?`)) return;

    setSendingEmail(app.id);
    setEmailError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session. Please sign in again.');
      }

      let providerToken = session.provider_token;
      let providerRefreshToken = session.provider_refresh_token;

      if (!providerToken || !providerRefreshToken) {
        const authTokenKey = Object.keys(localStorage).find(key =>
          key.includes('-auth-token')
        );

        if (authTokenKey) {
          const authTokenData = localStorage.getItem(authTokenKey);
          if (authTokenData) {
            try {
              const parsed = JSON.parse(authTokenData);
              providerToken = parsed.provider_token;
              providerRefreshToken = parsed.provider_refresh_token;
            } catch (err) {
              console.error('Failed to parse auth token:', err);
            }
          }
        }
      }

      if (!providerToken && !providerRefreshToken) {
        throw new Error('Missing Gmail tokens. Please sign out and sign in again with Google.');
      }

      const { data: resumeBlob, error: downloadError } = await supabase.storage
        .from('resumes')
        .download(resume.file_url);

      if (downloadError) {
        throw new Error('Failed to download resume file');
      }

      const reader = new FileReader();
      const resumeBase64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = reader.result as string;
          const base64Content = base64.split(',')[1];
          resolve(base64Content);
        };
        reader.onerror = reject;
        reader.readAsDataURL(resumeBlob);
      });

      const filename = resume.file_url.split('/').pop() || 'resume.pdf';
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-gmail`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientEmail: app.recipient_email,
          subject: app.subject,
          body: app.email_body,
          provider_token: providerToken,
          provider_refresh_token: providerRefreshToken,
          attachment: {
            filename: filename,
            content: resumeBase64,
            mimeType: 'application/pdf',
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.needsReauth) {
          setEmailError({
            message: data.details || 'Please sign out and sign in again with Google to grant Gmail permissions.',
            needsReauth: true
          });

          await supabase
            .from('applications')
            .update({
              status: 'failed',
              error_message: data.details || 'Gmail authentication required'
            })
            .eq('id', app.id);

          await fetchApplications();
          return;
        }

        throw new Error(data.details || data.error || 'Failed to send email');
      }

      const { error: updateError } = await supabase
        .from('applications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          error_message: null
        })
        .eq('id', app.id);

      if (updateError) {
        console.error('Error updating application status:', updateError);
      }

      await fetchApplications();
      alert('Email sent successfully with your resume attached!');

    } catch (error) {
      console.error('Error sending email:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to send email';

      setEmailError({
        message: errorMessage,
        needsReauth: false
      });

      await supabase
        .from('applications')
        .update({
          status: 'failed',
          error_message: errorMessage
        })
        .eq('id', app.id);

      await fetchApplications();
    } finally {
      setSendingEmail(null);
    }
  }

  async function handleReauth() {
    if (confirm('You will be signed out and need to sign in again with Google. Continue?')) {
      await signOut();
    }
  }

  function handleSearch(value: string) {
    setSearchQuery(value);
    setCurrentPage(1);
  }

  function handleFilterChange(newFilter: typeof filter) {
    setFilter(newFilter);
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

  async function exportApplications() {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;

      const csv = [
        ['Recipient Email', 'Subject', 'Status', 'Created At', 'Sent At'].join(','),
        ...data.map(app => [
          app.recipient_email,
          `"${app.subject.replace(/"/g, '""')}"`,
          app.status,
          new Date(app.created_at).toLocaleString(),
          app.sent_at ? new Date(app.sent_at).toLocaleString() : ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `applications_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting applications:', error);
      alert('Failed to export applications');
    }
  }

  const statusConfig = {
    sent: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Sent', count: 0 },
    draft: { icon: FileText, color: 'text-slate-600', bg: 'bg-slate-50', label: 'Draft', count: 0 },
    failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Failed', count: 0 },
    scheduled: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Scheduled', count: 0 },
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  if (loading) {
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
          <h1 className="text-3xl font-bold text-slate-900">Applications</h1>
          <p className="text-slate-600 mt-1">
            Track and manage all your internship applications
          </p>
        </div>
        <button
          onClick={exportApplications}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Resume Status Alert */}
      {!resume && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">Resume Required</p>
              <p className="text-sm text-amber-700 mt-1">
                Please upload your resume in the Resume Manager before sending applications. Your resume will be automatically attached to all emails.
              </p>
            </div>
          </div>
        </div>
      )}

      {resume && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Paperclip className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">Resume Ready</p>
              <p className="text-sm text-green-700 mt-1">
                Your resume will be automatically attached to all emails you send.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {emailError && (
        <div className={`${emailError.needsReauth ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'} border rounded-xl p-4`}>
          <div className="flex items-start gap-3">
            <AlertCircle className={`w-5 h-5 ${emailError.needsReauth ? 'text-amber-600' : 'text-red-600'} flex-shrink-0 mt-0.5`} />
            <div className="flex-1">
              <p className={`text-sm font-medium ${emailError.needsReauth ? 'text-amber-900' : 'text-red-900'}`}>
                {emailError.needsReauth ? 'Re-authentication Required' : 'Failed to send email'}
              </p>
              <p className={`text-sm ${emailError.needsReauth ? 'text-amber-700' : 'text-red-700'} mt-1`}>
                {emailError.message}
              </p>
              {emailError.needsReauth && (
                <button
                  onClick={handleReauth}
                  className="mt-3 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
                >
                  Sign Out and Re-authenticate
                </button>
              )}
            </div>
            <button
              onClick={() => setEmailError(null)}
              className={`${emailError.needsReauth ? 'text-amber-400 hover:text-amber-600' : 'text-red-400 hover:text-red-600'}`}
            >
              <span className="text-xl leading-none">&times;</span>
            </button>
          </div>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by email, subject, or body..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors ${
            showFilters ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Filter Chips */}
      {showFilters && (
        <div className="flex gap-2 flex-wrap">
          {['all', 'sent', 'draft', 'scheduled', 'failed'].map((status) => (
            <button
              key={status}
              onClick={() => handleFilterChange(status as typeof filter)}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filter === status
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Applications Table */}
      {applications.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-200 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Send className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {searchQuery ? 'No matching applications found' : filter === 'all' ? 'No applications yet' : `No ${filter} applications`}
          </h3>
          <p className="text-sm text-slate-600">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : filter === 'all'
              ? 'Create your first application to get started'
              : `You don't have any ${filter} applications`
            }
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th 
                    className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('recipient_email')}
                  >
                    <div className="flex items-center gap-1">
                      Recipient
                      {sortBy === 'recipient_email' && (
                        <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-1">
                      Date
                      {sortBy === 'created_at' && (
                        <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {applications.map((app) => {
                  const config = statusConfig[app.status];
                  const Icon = config.icon;
                  return (
                    <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-900">
                          {app.recipient_email}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-700 line-clamp-2">
                          {app.subject}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${config.bg} ${config.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">
                          {app.sent_at
                            ? new Date(app.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          }
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {app.status === 'draft' && (
                            <button
                              onClick={() => handleSendEmail(app)}
                              disabled={sendingEmail === app.id || !resume}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={resume ? "Send Email with Resume" : "Upload resume first"}
                            >
                              {sendingEmail === app.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedApp(app)}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(app.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-600">
                Showing {applications.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} applications
              </div>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              
              {/* Page Numbers */}
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
                      className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
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
                className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Application Detail Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedApp(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Application Details</h2>
              <button
                onClick={() => setSelectedApp(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span className="text-2xl leading-none text-slate-400">&times;</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Recipient Email
                </label>
                <p className="text-slate-900 font-medium">{selectedApp.recipient_email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Subject
                </label>
                <p className="text-slate-900 font-medium">{selectedApp.subject}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Email Body
                </label>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 whitespace-pre-wrap text-sm text-slate-700 max-h-96 overflow-y-auto">
                  {selectedApp.email_body}
                </div>
              </div>

              {resume && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      Resume will be attached when sent
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Status
                  </label>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${statusConfig[selectedApp.status].bg} ${statusConfig[selectedApp.status].color}`}>
                    {(() => {
                      const Icon = statusConfig[selectedApp.status].icon;
                      return <Icon className="w-4 h-4" />;
                    })()}
                    {statusConfig[selectedApp.status].label}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Created At
                  </label>
                  <p className="text-sm text-slate-900">
                    {new Date(selectedApp.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                {selectedApp.sent_at && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      Sent At
                    </label>
                    <p className="text-sm text-slate-900">
                      {new Date(selectedApp.sent_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}

                {selectedApp.scheduled_for && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      Scheduled For
                    </label>
                    <p className="text-sm text-slate-900">
                      {new Date(selectedApp.scheduled_for).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>

              {selectedApp.error_message && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <label className="block text-sm font-medium text-red-900 mb-1">
                    Error Message
                  </label>
                  <p className="text-sm text-red-700">{selectedApp.error_message}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                {selectedApp.status === 'draft' && (
                  <button
                    onClick={() => {
                      handleSendEmail(selectedApp);
                      setSelectedApp(null);
                    }}
                    disabled={!resume}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    Send Email
                  </button>
                )}
                <button
                  onClick={() => {
                    handleDelete(selectedApp.id);
                    setSelectedApp(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={() => setSelectedApp(null)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors ml-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}