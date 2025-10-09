import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { X, Sparkles } from 'lucide-react';

interface AddPostModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPostModal({ onClose, onSuccess }: AddPostModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [mode, setMode] = useState<'manual' | 'ai'>('ai');
  const [rawText, setRawText] = useState('');
  const [formData, setFormData] = useState({
    company_name: '',
    position_title: '',
    description: '',
    contact_email: '',
    company_activity: '',
    industry_sector: '',
    deadline: '',
    post_url: '',
  });

  async function handleAIExtract() {
    if (!rawText.trim()) {
      alert('Please paste some text to extract information from');
      return;
    }

    setExtracting(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-post-info`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: rawText }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract information');
      }

      const { data } = await response.json();
      setFormData({
        company_name: data.company_name || '',
        position_title: data.position_title || '',
        description: data.description || rawText,
        contact_email: data.contact_email || '',
        company_activity: data.company_activity || '',
        industry_sector: data.industry_sector || '',
        deadline: data.deadline || '',
        post_url: data.post_url || '',
      });
      setMode('manual');
    } catch (error) {
      console.error('Error extracting post info:', error);
      alert('Failed to extract information. Please try again or enter manually.');
    } finally {
      setExtracting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('internship_posts').insert({
        user_id: user.id,
        company_name: formData.company_name,
        position_title: formData.position_title,
        description: formData.description,
        contact_email: formData.contact_email || null,
        company_activity: formData.company_activity || null,
        industry_sector: formData.industry_sector || null,
        deadline: formData.deadline || null,
        post_url: formData.post_url || null,
        extracted_emails: [],
      });

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error adding post:', error);
      alert('Failed to add post. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Add Internship Post</h2>
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
            onClick={() => setMode('ai')}
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
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Paste Job Posting Text
              </label>
              <textarea
                rows={12}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                placeholder="Paste the entire job posting here... AI will extract company name, position, description, emails, and other details automatically."
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-900">
                Simply paste the job posting text from any source. AI will automatically extract all relevant information including company details, position, requirements, and contact emails.
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
                    Extract with AI
                  </>
                )}
              </button>
            </div>
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
              placeholder="e.g., Google"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Position Title *
            </label>
            <input
              type="text"
              required
              value={formData.position_title}
              onChange={(e) => setFormData({ ...formData, position_title: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="e.g., Software Engineering Intern"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Job Description *
            </label>
            <textarea
              required
              rows={6}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
              placeholder="Paste the job description here..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Contact Email
              </label>
              <input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="recruiter@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Industry Sector
              </label>
              <input
                type="text"
                value={formData.industry_sector}
                onChange={(e) => setFormData({ ...formData, industry_sector: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="e.g., Technology"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Company Activity
              </label>
              <input
                type="text"
                value={formData.company_activity}
                onChange={(e) => setFormData({ ...formData, company_activity: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="e.g., AI & Cloud Services"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Application Deadline
              </label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Post URL
            </label>
            <input
              type="url"
              value={formData.post_url}
              onChange={(e) => setFormData({ ...formData, post_url: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="https://..."
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
              {loading ? 'Adding...' : 'Add Post'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
