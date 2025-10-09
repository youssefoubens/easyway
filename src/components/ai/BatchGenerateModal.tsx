import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Sparkles, X, AlertCircle, CheckCircle, Building2 } from 'lucide-react';

interface Contact {
  id: string;
  company_name: string;
  email: string;
  industry: string | null;
  notes: string | null;
}

interface BatchGenerateModalProps {
  contacts: Contact[];
  onClose: () => void;
  onSuccess: () => void;
}

export function BatchGenerateModal({ contacts, onClose, onSuccess }: BatchGenerateModalProps) {
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: contacts.length });

  async function handleBatchGenerate() {
    setGenerating(true);
    setMessage(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-personalized-message`;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        setProgress({ current: i + 1, total: contacts.length });

        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contactId: contact.id,
              companyName: contact.company_name,
              companyEmail: contact.email,
              companyIndustry: contact.industry || '',
              companyNotes: contact.notes || '',
              messageType: 'spontaneous',
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }

          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error generating message for ${contact.company_name}:`, error);
          failCount++;
        }
      }

      setMessage({
        type: successCount > 0 ? 'success' : 'error',
        text: `Generated ${successCount} messages successfully${failCount > 0 ? `, ${failCount} failed` : ''}`
      });

      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (error) {
      console.error('Error in batch generation:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to generate messages. Please try again.'
      });
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            Batch Generate AI Messages
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            disabled={generating}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">
              Generate personalized spontaneous application messages for {contacts.length} selected companies.
              Each message will be tailored based on your profile and the company information.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 max-h-64 overflow-y-auto">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Selected Companies</h3>
            <div className="space-y-2">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-center gap-3 p-2 bg-white rounded-lg">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{contact.company_name}</p>
                    <p className="text-xs text-slate-500 truncate">{contact.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {generating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Progress</span>
                <span className="font-medium text-slate-900">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {message && (
            <div
              className={`p-4 rounded-xl flex items-start gap-3 ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <p
                className={`text-sm font-medium ${
                  message.type === 'success' ? 'text-green-900' : 'text-red-900'
                }`}
              >
                {message.text}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              disabled={generating}
            >
              Cancel
            </button>
            <button
              onClick={handleBatchGenerate}
              disabled={generating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate All Messages
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
