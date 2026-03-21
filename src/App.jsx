import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Splash from './pages/Splash';
import Dashboard from './pages/Dashboard';
import JobSearch from './pages/JobSearch';
import JobApproval from './pages/JobApproval';
import Signature from './pages/Signature';
import Confirmation from './pages/Confirmation';
import Review from './pages/Review';
import Admin from './pages/Admin';
import TimeClock from './pages/TimeClock';
import TimeEntries from './pages/TimeEntries';
import VendorBank from './pages/VendorBank';
import Expenses from './pages/Expenses';
import CalendarPage from './pages/CalendarPage';
import DocumentTemplates from './pages/DocumentTemplates';
import EmployeeManager from './pages/EmployeeManager';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/search" element={<JobSearch />} />
      <Route path="/approve" element={<JobApproval />} />
      <Route path="/signature" element={<Signature />} />
      <Route path="/confirmation" element={<Confirmation />} />
      <Route path="/review" element={<Review />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/time-clock" element={<TimeClock />} />
      <Route path="/time-entries" element={<TimeEntries />} />
      <Route path="/vendors" element={<VendorBank />} />
      <Route path="/expenses" element={<Expenses />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/templates" element={<DocumentTemplates />} />
      <Route path="/employees" element={<EmployeeManager />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App