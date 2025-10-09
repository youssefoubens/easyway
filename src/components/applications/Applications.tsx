import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Send, Eye, Trash2, CheckCircle, Clock, XCircle, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

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

export function Applications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [filter, setFilter] = useState<'all' | 'draft' | 'sent' | 'failed' | 'scheduled'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchApplications();
  }, [user, currentPage, filter]);

  async function fetchApplications() {
    if (!user) return;

    try {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from('applications')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setApplications(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendEmail(app: Application) {
    if (!user?.email) {
      alert('Please make sure you are logged in with an email');
      return;
    }

    if (!confirm(`Send this email to ${app.recipient_email}?`)) return;

    setSendingId(app.id);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      // Get your Supabase project URL from environment or config
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          from: user.email,
          to: app.recipient_email,
          subject: app.subject,
          body: app.email_body,
          applicationId: app.id
        })
      });

      const responseText = await response.text();
      let errorData;
      
      try {
        errorData = JSON.parse(responseText);
      } catch {
        throw new Error(`Server error: ${responseText || 'No response from server'}`);
      }

      if (!response.ok) {
        throw new Error(errorData.error || 'Failed to send email');
      }

      // Update application status to sent
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          error_message: null
        })
        .eq('id', app.id);

      if (updateError) throw updateError;

      alert('Email sent successfully!');
      await fetchApplications();
      if (selectedApp?.id === app.id) {
        setSelectedApp(null);
      }
    } catch (error: any) {
      console.error('Error sending email:', error);
      
      // Update status to failed with error message
      await supabase
        .from('applications')
        .update({
          status: 'failed',
          error_message: error.message || 'Failed to send email'
        })
        .eq('id', app.id);

      alert(`Failed to send email: ${error.message}`);
      await fetchApplications();
    } finally {
      setSendingId(null);
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
    } catch (error) {
      console.error('Error deleting application:', error);
    }
  }

  const filteredApps = applications;

  const statusConfig = {
    sent: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Sent' },
    draft: { icon: FileText, color: 'text-slate-600', bg: 'bg-slate-50', label: 'Draft' },
    failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Failed' },
    scheduled: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Scheduled' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Applications</h1>
          <p className="text-slate-600 mt-1">
            Track all your internship applications
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'sent', 'draft', 'scheduled', 'failed'].map((status) => (
          <button
            key={status}
            onClick={() => {
              setFilter(status as typeof filter);
              setCurrentPage(1);
            }}
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

      {filteredApps.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-200 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Send className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {filter === 'all' ? 'No applications yet' : `No ${filter} applications`}
          </h3>
          <p className="text-sm text-slate-600">
            {filter === 'all'
              ? 'Create your first application to get started'
              : `You don't have any ${filter} applications`
            }
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Recipient
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredApps.map((app) => {
                  const config = statusConfig[app.status];
                  const Icon = config.icon;
                  const isSending = sendingId === app.id;
                  return (
                    <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-900">
                          {app.recipient_email}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-700 line-clamp-1">
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
                            ? new Date(app.sent_at).toLocaleDateString()
                            : new Date(app.created_at).toLocaleDateString()
                          }
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {(app.status === 'draft' || app.status === 'failed') && (
                            <button
                              onClick={() => handleSendEmail(app)}
                              disabled={isSending}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Send Email"
                            >
                              {isSending ? (
                                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedApp(app)}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View"
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
          {totalCount > itemsPerPage && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} applications
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage * itemsPerPage >= totalCount}
                  className="flex items-center gap-1 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Application Details</h2>
              <button
                onClick={() => setSelectedApp(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span className="text-2xl leading-none">&times;</span>
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
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 whitespace-pre-wrap text-sm text-slate-700">
                  {selectedApp.email_body}
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-slate-200">
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

                {selectedApp.sent_at && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      Sent At
                    </label>
                    <p className="text-slate-900">
                      {new Date(selectedApp.sent_at).toLocaleString()}
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

              {(selectedApp.status === 'draft' || selectedApp.status === 'failed') && (
                <div className="pt-4 border-t border-slate-200">
                  <button
                    onClick={() => handleSendEmail(selectedApp)}
                    disabled={sendingId === selectedApp.id}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {sendingId === selectedApp.id ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Send Email Now
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}