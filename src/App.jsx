import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { NavigationProvider } from '@/lib/NavigationContext';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import BottomNav from '@/components/BottomNav';
import { motion, AnimatePresence } from 'framer-motion';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// Core pages (loaded immediately)
import Splash from './pages/Splash';
import AccessGate from './pages/AccessGate';
import VerifyInvitePublic from './pages/VerifyInvite';

// Lazy-loaded pages (code splitting)
const Notes = lazy(() => import('./pages/Notes'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const JobSearch = lazy(() => import('./pages/JobSearch'));
const JobApproval = lazy(() => import('./pages/JobApproval'));
const Signature = lazy(() => import('./pages/Signature'));
const Confirmation = lazy(() => import('./pages/Confirmation'));
const Review = lazy(() => import('./pages/Review'));
const Admin = lazy(() => import('./pages/Admin'));
const TimeClock = lazy(() => import('./pages/TimeClock'));
const TimeEntries = lazy(() => import('./pages/TimeEntries'));
const TimeEntryDetail = lazy(() => import('./pages/TimeEntryDetail'));
const VendorBank = lazy(() => import('./pages/VendorBank'));
const Expenses = lazy(() => import('./pages/Expenses'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const DocumentTemplates = lazy(() => import('./pages/DocumentTemplates'));
const EmployeeManager = lazy(() => import('./pages/EmployeeManager'));
const EmployeePermissions = lazy(() => import('./pages/EmployeePermissions'));
const Financials = lazy(() => import('./pages/Financials'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const Bills = lazy(() => import('./pages/Bills'));
const Invoices = lazy(() => import('./pages/Invoices'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const Warranty = lazy(() => import('./pages/Warranty'));
const WarrantyDetail = lazy(() => import('./pages/WarrantyDetail'));
const CustomFields = lazy(() => import('./pages/CustomFields'));
const PortalManager = lazy(() => import('./pages/PortalManager'));
const ClientPortal = lazy(() => import('./pages/ClientPortal'));
const VendorPortal = lazy(() => import('./pages/VendorPortal'));
const ChangeOrders = lazy(() => import('./pages/ChangeOrders'));
const ChangeOrderDetail = lazy(() => import('./pages/ChangeOrderDetail'));
const JobComms = lazy(() => import('./pages/JobComms'));
const JobCommsDetail = lazy(() => import('./pages/JobCommsDetail'));
const Tasks = lazy(() => import('./pages/Tasks'));
const TaskDetail = lazy(() => import('./pages/TaskDetail'));
const DailyLogs = lazy(() => import('./pages/DailyLogs'));
const DailyLogDetail = lazy(() => import('./pages/DailyLogDetail'));
const Sales = lazy(() => import('./pages/Sales'));
const LeadDetail = lazy(() => import('./pages/LeadDetail'));
const Estimates = lazy(() => import('./pages/Estimates'));
const EstimateDetail = lazy(() => import('./pages/EstimateDetail'));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'));
const JobHub = lazy(() => import('./pages/JobHub'));
const AdminOverview = lazy(() => import('./pages/AdminOverview'));
// VerifyInvite is loaded eagerly as a public route (no auth required)
const GlobalSearch = lazy(() => import('./pages/GlobalSearch'));
const NewJobPage = lazy(() => import('./pages/NewJobPage'));
const MobileSettings = lazy(() => import('./pages/MobileSettings'));

// Loading fallback
function RouteLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    </div>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

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
      navigateToLogin();
      return null;
    }
  }

  // Render the main app with slide transition animations
  return (
    <SafeAreaWrapper>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="flex-1 overflow-y-auto pb-16"
        >
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              {/* Auth Routes */}
              <Route path="/" element={<Splash />} />
              <Route path="/gate" element={<AccessGate />} />

              {/* Core Workflow Routes */}
              <Route path="/notes" element={<Notes />} />
              <Route path="/signature" element={<Signature />} />
              <Route path="/approval" element={<JobApproval />} />
              <Route path="/approve" element={<JobApproval />} />
              <Route path="/confirmation" element={<Confirmation />} />
              <Route path="/review" element={<Review />} />

              {/* Dashboard Routes */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/job-hub" element={<JobHub />} />
              <Route path="/admin-overview" element={<AdminOverview />} />
              <Route path="/search" element={<JobSearch />} />
              <Route path="/global-search" element={<GlobalSearch />} />
              <Route path="/new-job" element={<NewJobPage />} />

              {/* Time Tracking Routes */}
              <Route path="/time-clock" element={<TimeClock />} />
              <Route path="/time-entries" element={<TimeEntries />} />
              <Route path="/time-entries/:id" element={<TimeEntryDetail />} />

              {/* Financial Routes */}
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/bills" element={<Bills />} />
              <Route path="/purchase-orders" element={<PurchaseOrders />} />
              <Route path="/financials" element={<Financials />} />

              {/* Operations Routes */}
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/tasks/:id" element={<TaskDetail />} />
              <Route path="/daily-logs" element={<DailyLogs />} />
              <Route path="/daily-logs/:id" element={<DailyLogDetail />} />
              <Route path="/warranty" element={<Warranty />} />
              <Route path="/warranty/:id" element={<WarrantyDetail />} />

              {/* Sales Routes */}
              <Route path="/sales" element={<Sales />} />
              <Route path="/sales/:id" element={<LeadDetail />} />
              <Route path="/estimates" element={<Estimates />} />
              <Route path="/estimates/:id" element={<EstimateDetail />} />
              <Route path="/change-orders" element={<ChangeOrders />} />
              <Route path="/change-orders/:id" element={<ChangeOrderDetail />} />

              {/* Communication Routes */}
              <Route path="/job-comms" element={<JobComms />} />
              <Route path="/job-comms/detail" element={<JobCommsDetail />} />

              {/* Portal Routes */}
              <Route path="/portal-manager" element={<PortalManager />} />
              <Route path="/portal/client" element={<ClientPortal />} />
              <Route path="/portal/vendor" element={<VendorPortal />} />

              {/* Admin Routes */}
              <Route path="/admin" element={<Admin />} />
              <Route path="/vendors" element={<VendorBank />} />
              <Route path="/employees" element={<EmployeeManager />} />
              <Route path="/employee-permissions" element={<EmployeePermissions />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/templates" element={<DocumentTemplates />} />
              <Route path="/custom-fields" element={<CustomFields />} />
              <Route path="/audit-log" element={<AuditLogPage />} />

              {/* Settings Routes */}
              <Route path="/mobile-settings" element={<MobileSettings />} />

              {/* 404 */}
              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
      <BottomNav />
    </SafeAreaWrapper>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationProvider>
            {/* Public route — must be checked before AuthenticatedApp to avoid auth gate */}
            <Routes>
              <Route path="/verify-invite" element={<VerifyInvitePublic />} />
              <Route path="*" element={<AuthenticatedApp />} />
            </Routes>
          </NavigationProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App