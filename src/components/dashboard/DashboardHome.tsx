import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { FileText, Briefcase, Mail, Send, TrendingUp, Clock } from 'lucide-react';

interface Stats {
  resumes: number;
  posts: number;
  contacts: number;
  applications: {
    total: number;
    sent: number;
    draft: number;
    scheduled: number;
  };
}

export function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    resumes: 0,
    posts: 0,
    contacts: 0,
    applications: { total: 0, sent: 0, draft: 0, scheduled: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user) return;

      try {
        const [resumesRes, postsRes, contactsRes, appsRes] = await Promise.all([
          supabase.from('resumes').select('id', { count: 'exact', head: true }),
          supabase.from('internship_posts').select('id', { count: 'exact', head: true }),
          supabase.from('email_contacts').select('id', { count: 'exact', head: true }),
          supabase.from('applications').select('status'),
        ]);

        const applications = appsRes.data || [];
        const appStats = {
          total: applications.length,
          sent: applications.filter((a) => a.status === 'sent').length,
          draft: applications.filter((a) => a.status === 'draft').length,
          scheduled: applications.filter((a) => a.status === 'scheduled').length,
        };

        setStats({
          resumes: resumesRes.count || 0,
          posts: postsRes.count || 0,
          contacts: contactsRes.count || 0,
          applications: appStats,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [user]);

  const statCards = [
    {
      name: 'Resume',
      value: stats.resumes,
      icon: FileText,
      color: 'bg-blue-500',
      description: 'Uploaded resumes',
    },
    {
      name: 'Internship Posts',
      value: stats.posts,
      icon: Briefcase,
      color: 'bg-green-500',
      description: 'Saved opportunities',
    },
    {
      name: 'Email Contacts',
      value: stats.contacts,
      icon: Mail,
      color: 'bg-purple-500',
      description: 'Company contacts',
    },
    {
      name: 'Applications',
      value: stats.applications.total,
      icon: Send,
      color: 'bg-orange-500',
      description: 'Total applications',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Welcome back! Here's your application overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.name}
              className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600">{card.name}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{card.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{card.description}</p>
                </div>
                <div className={`w-12 h-12 ${card.color} rounded-xl flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Application Status
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-green-900">Sent</span>
              <span className="text-lg font-bold text-green-700">{stats.applications.sent}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm font-medium text-slate-900">Draft</span>
              <span className="text-lg font-bold text-slate-700">{stats.applications.draft}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium text-blue-900">Scheduled</span>
              <span className="text-lg font-bold text-blue-700">{stats.applications.scheduled}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Quick Actions
          </h2>
          <div className="space-y-3">
            {stats.resumes === 0 && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-1">Upload Your Resume</p>
                <p className="text-xs text-blue-700">Get started by uploading your resume to enable AI-powered applications.</p>
              </div>
            )}
            {stats.posts === 0 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-900 mb-1">Add Internship Posts</p>
                <p className="text-xs text-green-700">Save internship opportunities to apply with personalized emails.</p>
              </div>
            )}
            {stats.contacts === 0 && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm font-medium text-purple-900 mb-1">Add Email Contacts</p>
                <p className="text-xs text-purple-700">Build your contact list for batch applications.</p>
              </div>
            )}
            {stats.resumes > 0 && stats.posts === 0 && stats.contacts === 0 && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-sm font-medium text-slate-900 mb-1">You're All Set!</p>
                <p className="text-xs text-slate-600">Add internship posts or contacts to start applying.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
