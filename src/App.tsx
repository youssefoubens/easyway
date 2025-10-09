import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { DashboardHome } from './components/dashboard/DashboardHome';
import { UserProfile } from './components/profile/UserProfile';
import { ResumeManager } from './components/resumes/ResumeManager';
import { InternshipPosts } from './components/posts/InternshipPosts';
import { EmailContacts } from './components/contacts/EmailContacts';
import { Applications } from './components/applications/Applications';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'resumes' | 'posts' | 'contacts' | 'applications' | 'profile'>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <DashboardLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {currentPage === 'dashboard' && <DashboardHome />}
      {currentPage === 'profile' && <UserProfile />}
      {currentPage === 'resumes' && <ResumeManager />}
      {currentPage === 'posts' && <InternshipPosts />}
      {currentPage === 'contacts' && <EmailContacts />}
      {currentPage === 'applications' && <Applications />}
    </DashboardLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
