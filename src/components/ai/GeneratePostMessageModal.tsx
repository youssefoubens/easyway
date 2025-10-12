import { useState } from 'react';
import { X, Sparkles, Copy, Check, Send, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface InternshipPost {
  id: string;
  company_name: string;
  position_title: string;
  description: string;
  contact_email: string | null;
  extracted_emails: string[];
  company_activity: string | null;
  industry_sector: string | null;
}

interface Props {
  post: InternshipPost;
  onClose: () => void;
  onSuccess: () => void;
}

export function GeneratePostMessageModal({ post, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState<{ subject: string; body: string } | null>(null);
  const [selectedEmail, setSelectedEmail] = useState(post.contact_email || post.extracted_emails[0] || '');
  const [copied, setCopied] = useState(false);

  const allEmails = [
    ...(post.contact_email ? [post.contact_email] : []),
    ...post.extracted_emails
  ].filter((email, index, self) => self.indexOf(email) === index);

  async function generateMessage() {
    if (!user) return;

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-application-email', {
        body: {
          postData: {
            company_name: post.company_name,
            position_title: post.position_title,
            description: post.description,
            company_activity: post.company_activity,
            industry_sector: post.industry_sector
          }
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setGeneratedMessage(data.data);
    } catch (error) {
      console.error('Error generating message:', error);
      alert('Failed to generate message. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!generatedMessage) return;
    
    const fullMessage = `Subject: ${generatedMessage.subject}\n\n${generatedMessage.body}`;
    await navigator.clipboard.writeText(fullMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    if (!generatedMessage || !user || !selectedEmail) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('applications').insert({
        user_id: user.id,
        post_id: post.id,
        recipient_email: selectedEmail,
        subject: generatedMessage.subject,
        email_body: generatedMessage.body,
        ai_generated: true,
        status: 'draft'
      });

      if (error) throw error;

      alert('Application saved as draft!');
      onSuccess();
    } catch (error) {
      console.error('Error saving application:', error);
      alert('Failed to save application. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-600" />
              Generate Application
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {post.position_title} at {post.company_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!generatedMessage ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Ready to Generate Your Application
              </h3>
              <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
                Our AI will create a personalized application email based on your resume and this internship posting.
              </p>
              <button
                onClick={generateMessage}
                disabled={generating}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Application
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Send To
                </label>
                <select
                  value={selectedEmail}
                  onChange={(e) => setSelectedEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {allEmails.map((email) => (
                    <option key={email} value={email}>
                      {email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Subject
                </label>
                <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-sm text-slate-900">{generatedMessage.subject}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Message
                </label>
                <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[300px]">
                  <p className="text-sm text-slate-900 whitespace-pre-wrap">
                    {generatedMessage.body}
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800">
                  💡 Review the generated message and make any necessary adjustments before saving or sending.
                </p>
              </div>
            </>
          )}
        </div>

        {generatedMessage && (
          <div className="p-6 border-t border-slate-200 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Save as Draft
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}