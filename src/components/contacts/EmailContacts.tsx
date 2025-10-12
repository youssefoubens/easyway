import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Mail, Edit as Edit2, Trash2, Building2, Sparkles, ChevronLeft, ChevronRight, Search, Filter, Download, Eye, X } from 'lucide-react';
import { AddContactModal } from './AddContactModal';
import { EditContactModal } from './EditContactModal';
import { GenerateMessageModal } from '../ai/GenerateMessageModal';
import { BatchGenerateModal } from '../ai/BatchGenerateModal';

interface EmailContact {
  id: string;
  company_name: string;
  email: string;
  industry: string | null;
  notes: string | null;
  created_at: string;
}

export function EmailContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<EmailContact | null>(null);
  const [generatingContact, setGeneratingContact] = useState<EmailContact | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<'company_name' | 'email' | 'created_at'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [viewingContact, setViewingContact] = useState<EmailContact | null>(null);
  const [industries, setIndustries] = useState<string[]>([]);

  useEffect(() => {
    fetchContacts();
    fetchIndustries();
  }, [user, currentPage, searchQuery, industryFilter, itemsPerPage, sortBy, sortOrder]);

  async function fetchIndustries() {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('email_contacts')
        .select('industry')
        .eq('user_id', user.id)
        .not('industry', 'is', null);

      if (error) throw error;
      
      const uniqueIndustries = Array.from(new Set(data.map(d => d.industry).filter(Boolean))) as string[];
      setIndustries(uniqueIndustries.sort());
    } catch (error) {
      console.error('Error fetching industries:', error);
    }
  }

  async function fetchContacts() {
    if (!user) return;

    try {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let query = supabase
        .from('email_contacts')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id);

      // Apply search filter
      if (searchQuery.trim()) {
        query = query.or(`company_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,notes.ilike.%${searchQuery}%`);
      }

      // Apply industry filter
      if (industryFilter !== 'all') {
        query = query.eq('industry', industryFilter);
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;
      setContacts(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      const { error } = await supabase
        .from('email_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Remove from selected contacts if it was selected
      const newSelected = new Set(selectedContacts);
      newSelected.delete(id);
      setSelectedContacts(newSelected);
      
      await fetchContacts();
      
      if (viewingContact?.id === id) {
        setViewingContact(null);
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Failed to delete contact. Please try again.');
    }
  }

  async function handleBulkDelete() {
    if (selectedContacts.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedContacts.size} contact(s)?`)) return;

    try {
      const { error } = await supabase
        .from('email_contacts')
        .delete()
        .in('id', Array.from(selectedContacts));

      if (error) throw error;
      
      setSelectedContacts(new Set());
      await fetchContacts();
      alert(`Successfully deleted ${selectedContacts.size} contact(s)`);
    } catch (error) {
      console.error('Error deleting contacts:', error);
      alert('Failed to delete contacts. Please try again.');
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

  function handleSort(column: typeof sortBy) {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  }

  async function exportContacts() {
    try {
      const { data, error } = await supabase
        .from('email_contacts')
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;

      const csv = [
        ['Company Name', 'Email', 'Industry', 'Notes', 'Created At'].join(','),
        ...data.map(contact => [
          `"${contact.company_name.replace(/"/g, '""')}"`,
          contact.email,
          contact.industry || '',
          `"${(contact.notes || '').replace(/"/g, '""')}"`,
          new Date(contact.created_at).toLocaleString()
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `email_contacts_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting contacts:', error);
      alert('Failed to export contacts');
    }
  }

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
          <h1 className="text-3xl font-bold text-slate-900">Email Contacts</h1>
          <p className="text-slate-600 mt-1">
            Manage your company contacts for batch applications
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {selectedContacts.size > 0 && (
            <>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors shadow-sm"
              >
                <Trash2 className="w-5 h-5" />
                Delete {selectedContacts.size}
              </button>
              <button
                onClick={() => setShowBatchModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all shadow-sm"
              >
                <Sparkles className="w-5 h-5" />
                Generate {selectedContacts.size} Messages
              </button>
            </>
          )}
          <button
            onClick={exportContacts}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Add Contact
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by company, email, or notes..."
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
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Industry</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleIndustryFilter('all')}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  industryFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                All Industries
              </button>
              {industries.map((industry) => (
                <button
                  key={industry}
                  onClick={() => handleIndustryFilter(industry)}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    industryFilter === industry
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {industry}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selection Info */}
      {selectedContacts.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-blue-900">
              {selectedContacts.size} contact(s) selected
            </p>
            <button
              onClick={() => setSelectedContacts(new Set())}
              className="text-sm text-blue-700 hover:text-blue-800 font-medium"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Contacts Table */}
      {contacts.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-200 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {searchQuery || industryFilter !== 'all' ? 'No matching contacts found' : 'No contacts yet'}
          </h3>
          <p className="text-sm text-slate-600 mb-6">
            {searchQuery || industryFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Add company email contacts to enable batch applications'
            }
          </p>
          {searchQuery || industryFilter !== 'all' ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setIndustryFilter('all');
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              Clear Filters
            </button>
          ) : (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Your First Contact
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 w-12">
                    <input
                      type="checkbox"
                      checked={selectedContacts.size === contacts.length && contacts.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedContacts(new Set(contacts.map(c => c.id)));
                        } else {
                          setSelectedContacts(new Set());
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-2 focus:ring-blue-500"
                    />
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('company_name')}
                  >
                    <div className="flex items-center gap-1">
                      Company
                      {sortBy === 'company_name' && (
                        <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-1">
                      Email
                      {sortBy === 'email' && (
                        <span className="text-blue-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedContacts.has(contact.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedContacts);
                          if (e.target.checked) {
                            newSelected.add(contact.id);
                          } else {
                            newSelected.delete(contact.id);
                          }
                          setSelectedContacts(newSelected);
                        }}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="font-medium text-slate-900">{contact.company_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {contact.email}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      {contact.industry ? (
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                          {contact.industry}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600 line-clamp-2">
                        {contact.notes || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewingContact(contact)}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setGeneratingContact(contact)}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Generate AI Message"
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingContact(contact)}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-600">
                Showing {contacts.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} contacts
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

      {/* View Contact Modal */}
      {viewingContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setViewingContact(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Contact Details</h2>
              <button
                onClick={() => setViewingContact(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{viewingContact.company_name}</h3>
                  <a
                    href={`mailto:${viewingContact.email}`}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {viewingContact.email}
                  </a>
                </div>
              </div>

              {viewingContact.industry && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Industry
                  </label>
                  <span className="inline-block px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium">
                    {viewingContact.industry}
                  </span>
                </div>
              )}

              {viewingContact.notes && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Notes
                  </label>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap">
                    {viewingContact.notes}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Added On
                </label>
                <p className="text-sm text-slate-900">
                  {new Date(viewingContact.created_at).toLocaleString('en-US', {
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
                    setGeneratingContact(viewingContact);
                    setViewingContact(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Message
                </button>
                <button
                  onClick={() => {
                    setEditingContact(viewingContact);
                    setViewingContact(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    handleDelete(viewingContact.id);
                    setViewingContact(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={() => setViewingContact(null)}
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
        <AddContactModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchContacts();
            fetchIndustries();
          }}
        />
      )}

      {editingContact && (
        <EditContactModal
          contact={editingContact}
          onClose={() => setEditingContact(null)}
          onSuccess={() => {
            setEditingContact(null);
            fetchContacts();
            fetchIndustries();
          }}
        />
      )}

      {generatingContact && (
        <GenerateMessageModal
          contact={generatingContact}
          onClose={() => setGeneratingContact(null)}
          onSuccess={() => {
            setGeneratingContact(null);
          }}
        />
      )}

      {showBatchModal && (
        <BatchGenerateModal
          contacts={contacts.filter(c => selectedContacts.has(c.id))}
          onClose={() => setShowBatchModal(false)}
          onSuccess={() => {
            setShowBatchModal(false);
            setSelectedContacts(new Set());
          }}
        />
      )}
    </div>
  );
}