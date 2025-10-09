import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { X, Sparkles, CheckCircle } from 'lucide-react';

interface AddContactModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ExtractedContact {
  company_name: string;
  email: string;
  industry: string | null;
  notes: string | null;
}

export function AddContactModal({ onClose, onSuccess }: AddContactModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [mode, setMode] = useState<'manual' | 'ai'>('ai');
  const [rawText, setRawText] = useState('');
  const [extractedContacts, setExtractedContacts] = useState<ExtractedContact[]>([]);
  const [formData, setFormData] = useState({
    company_name: '',
    email: '',
    industry: '',
    notes: '',
  });

  async function handleAIExtract() {
    if (!rawText.trim()) {
      alert('Please paste some text to extract contacts from');
      return;
    }

    setExtracting(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-emails`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: rawText }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract contacts');
      }

      const { data } = await response.json();
      if (data.length === 0) {
        alert('No email contacts found in the text. Please try different text or enter manually.');
        return;
      }
      setExtractedContacts(data);
    } catch (error) {
      console.error('Error extracting contacts:', error);
      alert('Failed to extract contacts. Please try again or enter manually.');
    } finally {
      setExtracting(false);
    }
  }

  async function handleBulkInsert() {
    if (!user || extractedContacts.length === 0) return;

    setLoading(true);
    try {
      const contactsToInsert = extractedContacts.map(contact => ({
        user_id: user.id,
        company_name: contact.company_name,
        email: contact.email,
        industry: contact.industry,
        notes: contact.notes,
      }));

      const { error } = await supabase.from('email_contacts').insert(contactsToInsert);

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error adding contacts:', error);
      alert('Failed to add contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('email_contacts').insert({
        user_id: user.id,
        company_name: formData.company_name,
        email: formData.email,
        industry: formData.industry || null,
        notes: formData.notes || null,
      });

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error adding contact:', error);
      alert('Failed to add contact. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Add Email Contact</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-b border-slate-200 px-6 py-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('ai');
              setExtractedContacts([]);
            }}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
              mode === 'ai'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 inline mr-2" />
            AI Extract
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
              mode === 'manual'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Manual Entry
          </button>
        </div>

        {mode === 'ai' ? (
          <div className="p-6 space-y-5">
            {extractedContacts.length === 0 ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Paste Text with Emails
                  </label>
                  <textarea
                    rows={10}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                    placeholder="Paste any text containing company emails. For example:&#10;&#10;- Contact list from a spreadsheet&#10;- Copied from a website&#10;- Recruitment email list&#10;- Company directory&#10;&#10;AI will automatically detect and extract all email addresses with company information."
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-900">
                    Paste any text containing emails. AI will automatically detect email addresses, infer company names, and organize everything for you. Perfect for bulk adding contacts from lists or directories.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAIExtract}
                    disabled={extracting || !rawText.trim()}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {extracting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Extract Contacts
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Found {extractedContacts.length} Contact{extractedContacts.length !== 1 ? 's' : ''}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setExtractedContacts([]);
                        setRawText('');
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Start Over
                    </button>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {extractedContacts.map((contact, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                              <span className="font-medium text-slate-900">{contact.company_name}</span>
                            </div>
                            <p className="text-sm text-blue-600 mb-1">{contact.email}</p>
                            {contact.industry && (
                              <span className="inline-block px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs">
                                {contact.industry}
                              </span>
                            )}
                            {contact.notes && (
                              <p className="text-xs text-slate-600 mt-2">{contact.notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkInsert}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Adding...' : `Add ${extractedContacts.length} Contact${extractedContacts.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Company Name *
            </label>
            <input
              type="text"
              required
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="e.g., Acme Corporation"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="contact@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Industry
            </label>
            <input
              type="text"
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="e.g., Technology, Finance"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Notes
            </label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
              placeholder="Optional notes about this contact..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Contact'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
