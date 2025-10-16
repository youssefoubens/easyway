import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Upload, FileText, Trash2, Download, CheckCircle, AlertCircle, Loader2, Star, Edit2, Plus } from 'lucide-react';

interface Resume {
  id: string;
  file_url: string;
  resume_name: string;
  is_active: boolean;
  education: string[];
  skills: string[];
  experience: any[];
  projects: any[];
  parsed_content: any;
  created_at: string;
  updated_at: string;
}

export function ResumeManager() {
  const { user } = useAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newResumeName, setNewResumeName] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadResumeName, setUploadResumeName] = useState('');

  useEffect(() => {
    fetchResumes();
  }, [user]);

  async function fetchResumes() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResumes(data || []);
    } catch (error) {
      console.error('Error fetching resumes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function parseResume(filePath: string) {
    setParsing(true);
    setMessage({ type: 'success', text: 'Parsing resume with AI...' });

    try {
      const { data, error } = await supabase.functions.invoke('parse-resume', {
        body: { filePath }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      return data.data;
    } catch (error) {
      console.error('Error parsing resume:', error);
      throw error;
    } finally {
      setParsing(false);
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate resume name
    if (!uploadResumeName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a name for this resume' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File size must be less than 10MB' });
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/rtf',
      'text/rtf',
      'text/plain',
    ];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Only PDF, DOCX, DOC, RTF, and TXT files are allowed' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      // Step 1: Upload file to storage
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const sanitizedName = uploadResumeName.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${sanitizedName}_${timestamp}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setMessage({ type: 'success', text: 'File uploaded! Parsing with AI...' });

      // Step 2: Parse resume with AI
      const parsedData = await parseResume(filePath);

      // Step 3: Insert new resume record
      // is_active will be set to true, and trigger will deactivate others
      const { error: insertError } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          file_url: filePath,
          resume_name: uploadResumeName.trim(),
          is_active: true, // Make new resume active
          parsed_content: parsedData.parsed_content || {},
          education: parsedData.education || [],
          skills: parsedData.skills || [],
          experience: parsedData.experience || [],
          projects: parsedData.projects || [],
        });

      if (insertError) throw insertError;

      setMessage({ type: 'success', text: 'Resume uploaded and parsed successfully!' });
      setShowUploadForm(false);
      setUploadResumeName('');
      await fetchResumes();
    } catch (error) {
      console.error('Error uploading resume:', error);
      setMessage({ type: 'error', text: 'Failed to upload resume. Please try again.' });
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  }

  async function handleSetActive(resumeId: string) {
    try {
      const { error } = await supabase
        .from('resumes')
        .update({ is_active: true })
        .eq('id', resumeId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Active resume updated!' });
      await fetchResumes();
    } catch (error) {
      console.error('Error setting active resume:', error);
      setMessage({ type: 'error', text: 'Failed to update active resume.' });
    }
  }

  async function handleRename(resumeId: string, currentName: string) {
    if (editingName === resumeId) {
      // Save the new name
      if (!newResumeName.trim()) {
        setMessage({ type: 'error', text: 'Resume name cannot be empty' });
        return;
      }

      try {
        const { error } = await supabase
          .from('resumes')
          .update({ resume_name: newResumeName.trim() })
          .eq('id', resumeId);

        if (error) throw error;

        setMessage({ type: 'success', text: 'Resume renamed successfully!' });
        setEditingName(null);
        setNewResumeName('');
        await fetchResumes();
      } catch (error) {
        console.error('Error renaming resume:', error);
        setMessage({ type: 'error', text: 'Failed to rename resume.' });
      }
    } else {
      // Start editing
      setEditingName(resumeId);
      setNewResumeName(currentName);
    }
  }

  async function handleDelete(resumeId: string, fileUrl: string) {
    if (!confirm('Are you sure you want to delete this resume?')) return;

    try {
      const { error: storageError } = await supabase.storage
        .from('resumes')
        .remove([fileUrl]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('resumes')
        .delete()
        .eq('id', resumeId);

      if (dbError) throw dbError;

      setMessage({ type: 'success', text: 'Resume deleted successfully!' });
      await fetchResumes();
    } catch (error) {
      console.error('Error deleting resume:', error);
      setMessage({ type: 'error', text: 'Failed to delete resume. Please try again.' });
    }
  }

  async function handleDownload(fileUrl: string) {
    try {
      const { data, error } = await supabase.storage
        .from('resumes')
        .download(fileUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileUrl.split('/').pop() || 'resume.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading resume:', error);
      setMessage({ type: 'error', text: 'Failed to download resume. Please try again.' });
    }
  }

  const activeResume = resumes.find(r => r.is_active);

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
          <h1 className="text-3xl font-bold text-slate-900">My Resumes</h1>
          <p className="text-slate-600 mt-1">
            Manage multiple resumes and select which one to use for applications
          </p>
        </div>
        <button
          onClick={() => setShowUploadForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Resume
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {parsing ? (
            <Loader2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5 animate-spin" />
          ) : message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p
            className={`text-sm font-medium ${
              parsing ? 'text-blue-900' : message.type === 'success' ? 'text-green-900' : 'text-red-900'
            }`}
          >
            {message.text}
          </p>
        </div>
      )}

      {/* Upload Form Modal */}
      {showUploadForm && (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Upload New Resume</h3>
              <p className="text-sm text-slate-600">
                Supported formats: PDF, DOCX, DOC, RTF, TXT (Max size: 10MB)
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Resume Name *
              </label>
              <input
                type="text"
                value={uploadResumeName}
                onChange={(e) => setUploadResumeName(e.target.value)}
                placeholder="e.g., Software Engineer Resume, General Resume"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={uploading || parsing}
              />
            </div>

            <div className="flex gap-3">
              <label className="flex-1">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.rtf,.txt"
                  onChange={handleFileUpload}
                  disabled={uploading || parsing || !uploadResumeName.trim()}
                  className="hidden"
                />
                <span 
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                    uploading || parsing || !uploadResumeName.trim()
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                  }`}
                >
                  {uploading || parsing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {parsing ? 'Parsing...' : 'Uploading...'}
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Choose File
                    </>
                  )}
                </span>
              </label>
              <button
                onClick={() => {
                  setShowUploadForm(false);
                  setUploadResumeName('');
                  setMessage(null);
                }}
                disabled={uploading || parsing}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resumes List */}
      {resumes.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-200 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No resumes yet</h3>
          <p className="text-sm text-slate-600 mb-4">
            Upload your first resume to start applying for internships
          </p>
          <button
            onClick={() => setShowUploadForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-5 h-5" />
            Upload Resume
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {resumes.map((resume) => (
            <div
              key={resume.id}
              className={`bg-white rounded-xl p-6 shadow-sm border-2 transition-all ${
                resume.is_active
                  ? 'border-blue-500 ring-2 ring-blue-100'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  resume.is_active ? 'bg-blue-600' : 'bg-slate-200'
                }`}>
                  <FileText className={`w-6 h-6 ${resume.is_active ? 'text-white' : 'text-slate-600'}`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {editingName === resume.id ? (
                      <input
                        type="text"
                        value={newResumeName}
                        onChange={(e) => setNewResumeName(e.target.value)}
                        onBlur={() => handleRename(resume.id, resume.resume_name)}
                        onKeyPress={(e) => e.key === 'Enter' && handleRename(resume.id, resume.resume_name)}
                        className="text-lg font-semibold text-slate-900 border-b-2 border-blue-500 focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <h3 className="text-lg font-semibold text-slate-900">{resume.resume_name}</h3>
                    )}
                    
                    {resume.is_active && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                        <Star className="w-3 h-3 fill-current" />
                        Active
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-slate-600 truncate mb-2">
                    {resume.file_url.split('/').pop()}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>Uploaded {new Date(resume.created_at).toLocaleDateString()}</span>
                    {resume.skills.length > 0 && (
                      <>
                        <span>•</span>
                        <span>{resume.skills.length} skills</span>
                      </>
                    )}
                    {resume.experience.length > 0 && (
                      <>
                        <span>•</span>
                        <span>{resume.experience.length} experiences</span>
                      </>
                    )}
                  </div>

                  {/* Skills Preview */}
                  {resume.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {resume.skills.slice(0, 6).map((skill, index) => (
                        <span
                          key={index}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                      {resume.skills.length > 6 && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                          +{resume.skills.length - 6} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {!resume.is_active && (
                    <button
                      onClick={() => handleSetActive(resume.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                    >
                      <Star className="w-4 h-4" />
                      Set Active
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleRename(resume.id, resume.resume_name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Rename
                  </button>
                  
                  <button
                    onClick={() => handleDownload(resume.file_url)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  
                  <button
                    onClick={() => handleDelete(resume.id, resume.file_url)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 Tips</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Upload multiple versions (e.g., "Tech Resume", "Marketing Resume")</li>
          <li>• The active resume (⭐) will be used for AI-generated applications</li>
          <li>• Switch between resumes anytime with the "Set Active" button</li>
          <li>• All resumes are parsed automatically to extract your skills and experience</li>
        </ul>
      </div>
    </div>
  );
}