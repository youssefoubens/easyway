import { useState } from 'react';
import { X, Sparkles, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
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
  posts: InternshipPost[];
  onClose: () => void;
  onSuccess: () => void;
}

interface GenerationResult {
  postId: string;
  companyName: string;
  positionTitle: string;
  status: 'pending' | 'generating' | 'success' | 'error';
  message?: { subject: string; body: string };
  error?: string;
  recipientEmail?: string;
}

export function BatchGeneratePostsModal({ posts, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResult[]>(
    posts.map(post => ({
      postId: post.id,
      companyName: post.company_name,
      positionTitle: post.position_title,
      status: 'pending' as const,
      recipientEmail: post.contact_email || post.extracted_emails[0] || ''
    }))
  );

  async function generateAllMessages() {
    if (!user) return;

    setGenerating(true);

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      
      // Update status to generating
      setResults(prev => prev.map((r, idx) => 
        idx === i ? { ...r, status: 'generating' } : r
      ));

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
        if (data.error) throw new Error(data.error);

        // Save to database
        const recipientEmail = post.contact_email || post.extracted_emails[0];
        if (recipientEmail) {
          await supabase.from('applications').insert({
            user_id: user.id,
            post_id: post.id,
            recipient_email: recipientEmail,
            subject: data.data.subject,
            email_body: data.data.body,
            ai_generated: true,
            status: 'draft'
          });
        }

        // Update result to success
        setResults(prev => prev.map((r, idx) => 
          idx === i ? { 
            ...r, 
            status: 'success', 
            message: data.data 
          } : r
        ));

        // Small delay between requests to avoid rate limiting
        if (i < posts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error('Error generating message:', error);
        setResults(prev => prev.map((r, idx) => 
          idx === i ? { 
            ...r, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Failed to generate'
          } : r
        ));
      }
    }

    setGenerating(false);
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const isComplete = results.every(r => r.status === 'success' || r.status === 'error');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-600" />
              Batch Generate Applications
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Generating messages for {posts.length} internship posts
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!generating && !isComplete ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Generate {posts.length} Applications
              </h3>
              <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
                Our AI will create personalized application emails for all selected internship posts. This may take a few minutes.
              </p>
              <button
                onClick={generateAllMessages}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all"
              >
                <Sparkles className="w-5 h-5" />
                Start Generation
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {isComplete && (
                <div className={`p-4 rounded-xl flex items-center gap-3 mb-4 ${
                  errorCount > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'
                }`}>
                  <CheckCircle className={`w-5 h-5 ${errorCount > 0 ? 'text-yellow-600' : 'text-green-600'}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${errorCount > 0 ? 'text-yellow-900' : 'text-green-900'}`}>
                      Generation complete: {successCount} successful, {errorCount} failed
                    </p>
                  </div>
                </div>
              )}

              {results.map((result, index) => (
                <div
                  key={result.postId}
                  className={`p-4 rounded-xl border transition-all ${
                    result.status === 'success' ? 'bg-green-50 border-green-200' :
                    result.status === 'error' ? 'bg-red-50 border-red-200' :
                    result.status === 'generating' ? 'bg-blue-50 border-blue-200' :
                    'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {result.status === 'generating' && (
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      )}
                      {result.status === 'success' && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                      {result.status === 'error' && (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                      {result.status === 'pending' && (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {result.positionTitle}
                      </p>
                      <p className="text-sm text-slate-600 truncate">
                        {result.companyName}
                      </p>
                      {result.status === 'generating' && (
                        <p className="text-xs text-blue-600 mt-1">Generating message...</p>
                      )}
                      {result.status === 'success' && (
                        <p className="text-xs text-green-600 mt-1">Saved as draft</p>
                      )}
                      {result.status === 'error' && (
                        <p className="text-xs text-red-600 mt-1">{result.error}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200">
          {isComplete ? (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={onSuccess}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                View Applications
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              disabled={generating}
              className="w-full px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}