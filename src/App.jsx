import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { NavigationProvider } from '@/lib/NavigationContext';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import BottomNav from '@/components/BottomNav';
import CompanyGuard from '@/components/CompanyGuard';
import { motion, AnimatePresence } from 'framer-motion';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { adminLogout, getSession, isAdmin, isSessionEmployeeStillValid, isUnlocked } from '@/lib/adminAuth';
import { shouldRequireUnlock } from '@/lib/routeSecurity';

// Core pages (loaded immediately)
import Splash from './pages/Splash';
import AccessGate from './pages/AccessGate';
import VerifyInvitePublic from './pages/VerifyInvite';
import AcceptInvitePublic from './pages/AcceptInvite';

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
const AdminCleanup = lazy(() => import('./pages/AdminCleanup'));
const BTImport = lazy(() => import('./pages/BTImport'));
// VerifyInvite is loaded eagerly as a public route (no auth required)
const GlobalSearch = lazy(() => import('./pages/GlobalSearch'));
const NewJobPage = lazy(() => import('./pages/NewJobPage'));
const MobileSettings = lazy(() => import('./pages/MobileSettings'));
const QBConnection = lazy(() => import('./pages/QBConnection'));
const CompanySelect = lazy(() => import('./pages/CompanySelect'));
const CRMPage = lazy(() => import('./pages/CRMPage'));
const XactimateImportPage = lazy(() => import('./pages/XactimateImportPage'));
const NexusInbox = lazy(() => import('./pages/NexusInbox'));
const CompanyAdmin = lazy(() => import('./pages/CompanyAdmin'));
const FieldDashboard = lazy(() => import('./pages/FieldDashboard'));
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard'));
const WorkOrders = lazy(() => import('./pages/WorkOrders'));
const WorkOrderDetail = lazy(() => import('./pages/WorkOrderDetail'));
const FieldSchedule = lazy(() => import('./pages/FieldSchedule'));
const RestorationHub = lazy(() => import('./pages/RestorationHub'));
const JobDocumentation = lazy(() => import('./pages/JobDocumentation'));
const MoistureReadingsPage = lazy(() => import('./pages/MoistureReadingsPage'));
const DryingLogsPage = lazy(() => import('./pages/DryingLogsPage'));
const AirSamplesPage = lazy(() => import('./pages/AirSamplesPage'));
const EquipmentPage = lazy(() => import('./pages/EquipmentPage'));
const GSCPField = lazy(() => import('./pages/GSCPField'));
const SubcontractReview = lazy(() => import('./pages/SubcontractReview'));
const SubcontractVisibility = lazy(() => import('./pages/SubcontractVisibility'));
const AccessManagement = lazy(() => import('./pages/AccessManagement'));
const AccessTests = lazy(() => import('./pages/AccessTests'));
const TemplatesHub = lazy(() => import('./pages/TemplatesHub'));
const LegacyImports = lazy(() => import('./pages/LegacyImports'));
const LegacyRecords = lazy(() => import('./pages/LegacyRecords'));
const MigrationDashboard = lazy(() => import('./pages/MigrationDashboard'));
const ProvenJobsChecklist = lazy(() => import('./pages/ProvenJobsChecklist'));
const JobTemplatesPage = lazy(() => import('./pages/JobTemplatesPage'));
const WorkOrderTemplatesPage = lazy(() => import('./pages/WorkOrderTemplatesPage'));
const DocumentationRequirementsPage = lazy(() => import('./pages/DocumentationRequirementsPage'));
const ReviewDashboard = lazy(() => import('./pages/ReviewDashboard'));
const RolloutChecklist = lazy(() => import('./pages/RolloutChecklist'));
const ReplacementMap = lazy(() => import('./pages/ReplacementMap'));
const KnownLimitations = lazy(() => import('./pages/KnownLimitations'));
const DemoDataPage = lazy(() => import('./pages/DemoDataPage'));
const ReviewFeedbackAdmin = lazy(() => import('./pages/ReviewFeedbackAdmin'));
const ReviewScript = lazy(() => import('./pages/ReviewScript'));
const ReviewDecisions = lazy(() => import('./pages/ReviewDecisions'));
const EdgeCaseTests = lazy(() => import('./pages/EdgeCaseTests'));
const ESXDraftWorkOrderQueue = lazy(() => import('./pages/ESXDraftWorkOrderQueue'));
const ESXSampleTests = lazy(() => import('./pages/ESXSampleTests'));

// Loading fallback
function RouteLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    </div>
  );
}

/**
 * UnlockGuard — renders children only if the app session is unlocked.
 * If locked, redirects to /gate. Public routes (/, /gate) are exempt.
 */
function UnlockGuard({ children }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const requiresUnlock = shouldRequireUnlock(location.pathname, location.search);
  const session = getSession();
  const sessionEmployeeId = session?.employee?.id;

  const { data: currentEmployee = null, isLoading: checkingSession, isError: sessionCheckFailed } = useQuery({
    queryKey: ['session-employee-validity', sessionEmployeeId],
    queryFn: async () => {
      const records = await base44.entities.Employee.filter({ id: sessionEmployeeId });
      return records?.[0] || null;
    },
    enabled: requiresUnlock && !!sessionEmployeeId,
    staleTime: 30 * 1000,
    retry: false,
  });

  if (requiresUnlock && !isUnlocked()) {
    // Use an effect-free immediate redirect via Navigate component
    return <Navigate to="/gate" replace />;
  }

  if (requiresUnlock && sessionEmployeeId && checkingSession) {
    return <RouteLoader />;
  }

  if (requiresUnlock && sessionEmployeeId && (sessionCheckFailed || !isSessionEmployeeStillValid(session, currentEmployee))) {
    adminLogout();
    sessionStorage.removeItem('active_company');
    queryClient.clear();
    return <Navigate to="/gate" replace />;
  }

  return children;
}

function AccessDenied() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <p className="text-base font-semibold text-foreground">Access restricted</p>
        <p className="mt-2 text-sm text-muted-foreground">
          You do not have access to this area. Please contact an admin.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to Dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate('/search')}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminRoute({ children }) {
  if (!isAdmin()) return <AccessDenied />;
  return children;
}

function CompanyRoute({ children }) {
  return <CompanyGuard>{children}</CompanyGuard>;
}

function adminOnly(element) {
  return <AdminRoute>{element}</AdminRoute>;
}

function companyRequired(element) {
  return <CompanyRoute>{element}</CompanyRoute>;
}

function adminCompanyOnly(element) {
  return adminOnly(companyRequired(element));
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
          className="flex-1 overflow-y-auto pb-16 lg:pb-0"
        >
          <Suspense fallback={<RouteLoader />}>
            <UnlockGuard>
            <Routes>
              {/* Public Routes — accessible without unlock */}
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
              <Route path="/dashboard" element={companyRequired(<Dashboard />)} />
              <Route path="/job-hub" element={companyRequired(<JobHub />)} />
              <Route path="/admin-overview" element={adminCompanyOnly(<AdminOverview />)} />
              {/* Super-admin maintenance route; intentionally not company scoped. */}
              <Route path="/admin-cleanup" element={adminOnly(<AdminCleanup />)} />
              <Route path="/bt-import" element={adminCompanyOnly(<BTImport />)} />
              <Route path="/search" element={companyRequired(<JobSearch />)} />
              <Route path="/global-search" element={companyRequired(<GlobalSearch />)} />
              {/* /search-jobs is the old scoped job-only search, kept for back-compat */}
              <Route path="/new-job" element={adminCompanyOnly(<NewJobPage />)} />

              {/* Time Tracking Routes */}
              <Route path="/time-clock" element={companyRequired(<TimeClock />)} />
              <Route path="/time-entries" element={companyRequired(<TimeEntries />)} />
              <Route path="/time-entries/:id" element={companyRequired(<TimeEntryDetail />)} />

              {/* Financial Routes */}
              <Route path="/invoices" element={adminCompanyOnly(<Invoices />)} />
              <Route path="/expenses" element={adminCompanyOnly(<Expenses />)} />
              <Route path="/payments" element={adminCompanyOnly(<PaymentsPage />)} />
              <Route path="/bills" element={adminCompanyOnly(<Bills />)} />
              <Route path="/purchase-orders" element={adminCompanyOnly(<PurchaseOrders />)} />
              <Route path="/financials" element={adminCompanyOnly(<Financials />)} />

              {/* Operations Routes */}
              <Route path="/tasks" element={companyRequired(<Tasks />)} />
              <Route path="/tasks/:id" element={companyRequired(<TaskDetail />)} />
              <Route path="/daily-logs" element={companyRequired(<DailyLogs />)} />
              <Route path="/daily-logs/:id" element={companyRequired(<DailyLogDetail />)} />
              <Route path="/warranty" element={companyRequired(<Warranty />)} />
              <Route path="/warranty/:id" element={companyRequired(<WarrantyDetail />)} />

              {/* Sales Routes */}
              <Route path="/sales" element={adminCompanyOnly(<Sales />)} />
              <Route path="/sales/:id" element={adminCompanyOnly(<LeadDetail />)} />
              <Route path="/estimates" element={adminCompanyOnly(<Estimates />)} />
              <Route path="/estimates/:id" element={adminCompanyOnly(<EstimateDetail />)} />
              <Route path="/change-orders" element={adminCompanyOnly(<ChangeOrders />)} />
              <Route path="/change-orders/:id" element={adminCompanyOnly(<ChangeOrderDetail />)} />

              {/* Communication Routes */}
              <Route path="/job-comms" element={companyRequired(<JobComms />)} />
              <Route path="/job-comms/detail" element={companyRequired(<JobCommsDetail />)} />

              {/* Portal Routes */}
              <Route path="/portal-manager" element={adminCompanyOnly(<PortalManager />)} />
              <Route path="/portal/client" element={<ClientPortal />} />
              <Route path="/portal/vendor" element={<VendorPortal />} />

              {/* Admin Routes */}
              <Route path="/admin" element={adminCompanyOnly(<Admin />)} />
              <Route path="/vendors" element={adminCompanyOnly(<VendorBank />)} />
              <Route path="/employees" element={adminCompanyOnly(<EmployeeManager />)} />
              <Route path="/employee-permissions" element={adminCompanyOnly(<EmployeePermissions />)} />
              <Route path="/calendar" element={companyRequired(<CalendarPage />)} />
              <Route path="/document-templates" element={adminCompanyOnly(<DocumentTemplates />)} />
              <Route path="/custom-fields" element={adminCompanyOnly(<CustomFields />)} />
              <Route path="/audit-log" element={adminCompanyOnly(<AuditLogPage />)} />
              <Route path="/qb-connection" element={adminCompanyOnly(<QBConnection />)} />
              <Route path="/company-select" element={<CompanySelect />} />
              <Route path="/crm" element={companyRequired(<CRMPage />)} />
              <Route path="/xactimate" element={companyRequired(<XactimateImportPage />)} />
              <Route path="/nexus" element={companyRequired(<NexusInbox />)} />
              <Route path="/company-admin" element={adminCompanyOnly(<CompanyAdmin />)} />
              <Route path="/field" element={companyRequired(<FieldDashboard />)} />
              <Route path="/manager" element={companyRequired(<ManagerDashboard />)} />
              <Route path="/work-orders" element={companyRequired(<WorkOrders />)} />
              <Route path="/work-orders/:id" element={companyRequired(<WorkOrderDetail />)} />
              <Route path="/field-schedule" element={companyRequired(<FieldSchedule />)} />
              <Route path="/restoration" element={companyRequired(<RestorationHub />)} />
              <Route path="/jobs/:id/documentation" element={companyRequired(<JobDocumentation />)} />
              <Route path="/moisture-readings" element={companyRequired(<MoistureReadingsPage />)} />
              <Route path="/drying-logs" element={companyRequired(<DryingLogsPage />)} />
              <Route path="/air-samples" element={companyRequired(<AirSamplesPage />)} />
              <Route path="/equipment" element={companyRequired(<EquipmentPage />)} />
              <Route path="/gscp-field" element={companyRequired(<GSCPField />)} />
              <Route path="/subcontract-review" element={companyRequired(<SubcontractReview />)} />
              <Route path="/subcontracts" element={companyRequired(<SubcontractVisibility />)} />
              <Route path="/access-management" element={adminCompanyOnly(<AccessManagement />)} />
              <Route path="/access-tests" element={adminCompanyOnly(<AccessTests />)} />
              <Route path="/templates" element={companyRequired(<TemplatesHub />)} />
              <Route path="/job-templates" element={companyRequired(<JobTemplatesPage />)} />
              <Route path="/work-order-templates" element={companyRequired(<WorkOrderTemplatesPage />)} />
              <Route path="/documentation-requirements" element={companyRequired(<DocumentationRequirementsPage />)} />
              <Route path="/legacy-imports" element={adminOnly(<LegacyImports />)} />
              <Route path="/legacy-records" element={adminOnly(<LegacyRecords />)} />
              <Route path="/migration-dashboard" element={adminOnly(<MigrationDashboard />)} />
              <Route path="/proven-jobs-checklist" element={adminOnly(<ProvenJobsChecklist />)} />
              <Route path="/review-dashboard" element={adminOnly(<ReviewDashboard />)} />
              <Route path="/rollout-checklist" element={adminOnly(<RolloutChecklist />)} />
              <Route path="/replacement-map" element={adminOnly(<ReplacementMap />)} />
              <Route path="/known-limitations" element={adminOnly(<KnownLimitations />)} />
              <Route path="/demo-data" element={adminOnly(<DemoDataPage />)} />
              <Route path="/review-feedback" element={adminOnly(<ReviewFeedbackAdmin />)} />
              <Route path="/review-script" element={adminOnly(<ReviewScript />)} />
              <Route path="/review-decisions" element={adminOnly(<ReviewDecisions />)} />
              <Route path="/edge-case-tests" element={adminCompanyOnly(<EdgeCaseTests />)} />
              <Route path="/esx-draft-work-orders" element={adminCompanyOnly(<ESXDraftWorkOrderQueue />)} />
              <Route path="/esx-sample-tests" element={adminCompanyOnly(<ESXSampleTests />)} />

              {/* Settings Routes */}
              <Route path="/mobile-settings" element={companyRequired(<MobileSettings />)} />

              {/* 404 */}
              <Route path="*" element={<PageNotFound />} />
            </Routes>
            </UnlockGuard>
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
              <Route path="/accept-invite" element={<AcceptInvitePublic />} />
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
