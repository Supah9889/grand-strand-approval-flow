import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Splash from './pages/Splash';
import AccessGate from './pages/AccessGate';
import Notes from './pages/Notes';
import Dashboard from './pages/Dashboard';
import JobSearch from './pages/JobSearch';
import JobApproval from './pages/JobApproval';
import Signature from './pages/Signature';
import Confirmation from './pages/Confirmation';
import Review from './pages/Review';
import Admin from './pages/Admin';
import TimeClock from './pages/TimeClock';
import TimeEntries from './pages/TimeEntries';
import TimeEntryDetail from './pages/TimeEntryDetail';
import VendorBank from './pages/VendorBank';
import Expenses from './pages/Expenses';
import CalendarPage from './pages/CalendarPage';
import DocumentTemplates from './pages/DocumentTemplates';
import EmployeeManager from './pages/EmployeeManager';
import EmployeePermissions from './pages/EmployeePermissions';
import Financials from './pages/Financials';
import PurchaseOrders from './pages/PurchaseOrders';
import Bills from './pages/Bills';
import Invoices from './pages/Invoices';
import PaymentsPage from './pages/PaymentsPage';
import Warranty from './pages/Warranty';
import WarrantyDetail from './pages/WarrantyDetail';
import CustomFields from './pages/CustomFields';
import PortalManager from './pages/PortalManager';
import ClientPortal from './pages/ClientPortal';
import VendorPortal from './pages/VendorPortal';
import ChangeOrders from './pages/ChangeOrders';
import ChangeOrderDetail from './pages/ChangeOrderDetail';
import JobComms from './pages/JobComms';
import JobCommsDetail from './pages/JobCommsDetail';
import Tasks from './pages/Tasks';
import TaskDetail from './pages/TaskDetail';
import DailyLogs from './pages/DailyLogs';
import DailyLogDetail from './pages/DailyLogDetail';
import Sales from './pages/Sales';
import LeadDetail from './pages/LeadDetail';
import Estimates from './pages/Estimates';
import EstimateDetail from './pages/EstimateDetail';
import AuditLogPage from './pages/AuditLogPage';
import JobHub from './pages/JobHub';
import AdminOverview from './pages/AdminOverview';
import VerifyInvite from './pages/VerifyInvite';

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
      <Route path="/gate" element={<AccessGate />} />
      <Route path="/notes" element={<Notes />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/search" element={<JobSearch />} />
      <Route path="/approve" element={<JobApproval />} />
      <Route path="/signature" element={<Signature />} />
      <Route path="/confirmation" element={<Confirmation />} />
      <Route path="/review" element={<Review />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/time-clock" element={<TimeClock />} />
      <Route path="/time-entries" element={<TimeEntries />} />
      <Route path="/time-entries/:id" element={<TimeEntryDetail />} />
      <Route path="/vendors" element={<VendorBank />} />
      <Route path="/expenses" element={<Expenses />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/templates" element={<DocumentTemplates />} />
      <Route path="/employees" element={<EmployeeManager />} />
      <Route path="/employee-permissions" element={<EmployeePermissions />} />
      <Route path="/financials" element={<Financials />} />
      <Route path="/purchase-orders" element={<PurchaseOrders />} />
      <Route path="/bills" element={<Bills />} />
      <Route path="/invoices" element={<Invoices />} />
      <Route path="/payments" element={<PaymentsPage />} />
      <Route path="/warranty" element={<Warranty />} />
      <Route path="/warranty/:id" element={<WarrantyDetail />} />
      <Route path="/custom-fields" element={<CustomFields />} />
      <Route path="/portal-manager" element={<PortalManager />} />
      <Route path="/portal/client" element={<ClientPortal />} />
      <Route path="/portal/vendor" element={<VendorPortal />} />
      <Route path="/change-orders" element={<ChangeOrders />} />
      <Route path="/change-orders/:id" element={<ChangeOrderDetail />} />
      <Route path="/job-comms" element={<JobComms />} />
      <Route path="/job-comms/detail" element={<JobCommsDetail />} />
      <Route path="/tasks" element={<Tasks />} />
      <Route path="/tasks/:id" element={<TaskDetail />} />
      <Route path="/daily-logs" element={<DailyLogs />} />
      <Route path="/daily-logs/:id" element={<DailyLogDetail />} />
      <Route path="/sales" element={<Sales />} />
      <Route path="/sales/:id" element={<LeadDetail />} />
      <Route path="/estimates" element={<Estimates />} />
      <Route path="/estimates/:id" element={<EstimateDetail />} />
      <Route path="/audit-log" element={<AuditLogPage />} />
      <Route path="/job-hub" element={<JobHub />} />
      <Route path="/admin-overview" element={<AdminOverview />} />
      <Route path="/verify-invite" element={<VerifyInvite />} />
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