import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Upload, FileText, Trash2, Download, CheckCircle, AlertCircle } from 'lucide-react';

interface Resume {
  id: string;
  file_url: string;
  education: string[];
  skills: string[];
  created_at: string;
}

export function ResumeManager() {
  const { user } = useAuth();
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchResume();
  }, [user]);

  async function fetchResume() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setResume(data);
    } catch (error) {
      console.error('Error fetching resume:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File size must be less than 5MB' });
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Only PDF and DOCX files are allowed' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('resumes')
        .getPublicUrl(filePath);

      if (resume) {
        const { error: updateError } = await supabase
          .from('resumes')
          .update({
            file_url: filePath,
            updated_at: new Date().toISOString(),
          })
          .eq('id', resume.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('resumes')
          .insert({
            user_id: user.id,
            file_url: filePath,
            parsed_content: {},
            education: [],
            skills: [],
            experience: [],
            projects: [],
          });

        if (insertError) throw insertError;
      }

      setMessage({ type: 'success', text: 'Resume uploaded successfully!' });
      await fetchResume();
    } catch (error) {
      console.error('Error uploading resume:', error);
      setMessage({ type: 'error', text: 'Failed to upload resume. Please try again.' });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!resume || !user) return;

    try {
      const { error: storageError } = await supabase.storage
        .from('resumes')
        .remove([resume.file_url]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('resumes')
        .delete()
        .eq('id', resume.id);

      if (dbError) throw dbError;

      setResume(null);
      setMessage({ type: 'success', text: 'Resume deleted successfully!' });
    } catch (error) {
      console.error('Error deleting resume:', error);
      setMessage({ type: 'error', text: 'Failed to delete resume. Please try again.' });
    }
  }

  async function handleDownload() {
    if (!resume) return;

    try {
      const { data, error } = await supabase.storage
        .from('resumes')
        .download(resume.file_url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = resume.file_url.split('/').pop() || 'resume.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading resume:', error);
      setMessage({ type: 'error', text: 'Failed to download resume. Please try again.' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Resume</h1>
        <p className="text-slate-600 mt-1">
          Upload your resume to enable AI-powered personalized applications
        </p>
      </div>

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

      <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
        {!resume ? (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Upload Your Resume</h3>
              <p className="text-sm text-slate-600">
                Supported formats: PDF, DOCX (Max size: 5MB)
              </p>
            </div>
            <label className="inline-block">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              <span className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Choose File
                  </>
                )}
              </span>
            </label>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-xl">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">Resume Uploaded</h3>
                <p className="text-sm text-slate-600 truncate">
                  {resume.file_url.split('/').pop()}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Uploaded on {new Date(resume.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {resume.skills.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Extracted Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {resume.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {resume.education.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Education</h4>
                <div className="space-y-2">
                  {resume.education.map((edu, index) => (
                    <div key={index} className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                      {edu}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <label className="flex-1">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <span className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Replace
                    </>
                  )}
                </span>
              </label>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 rounded-xl font-medium hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Note</h3>
        <p className="text-sm text-blue-800">
          Your resume is securely stored and will be used to generate personalized application
          emails. The AI will analyze your skills, experience, and education to match them with
          internship opportunities.
        </p>
      </div>
    </div>
  );
}
