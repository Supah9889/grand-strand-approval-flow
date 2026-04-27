import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import BottomSheet from '@/components/BottomSheet';
import AccountDeletionDialog from '@/components/AccountDeletionDialog';
import PullToRefresh from '@/components/PullToRefresh';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, LogOut } from 'lucide-react';
import { toast } from 'sonner';

const THEME_OPTIONS = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

const NOTIFICATION_OPTIONS = [
  { label: 'All Notifications', value: 'all' },
  { label: 'Important Only', value: 'important' },
  { label: 'None', value: 'none' },
];

export default function MobileSettings() {
  const [theme, setTheme] = useState('system');
  const [notifications, setNotifications] = useState('all');
  const [isThemeSheetOpen, setIsThemeSheetOpen] = useState(false);
  const [isNotificationSheetOpen, setIsNotificationSheetOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success('Settings refreshed');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    base44.auth.logout();
  };

  const handleDeleteSuccess = () => {
    toast.success('Account deleted successfully');
    base44.auth.logout();
  };

  return (
    <AppLayout title="Settings">
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
        <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5 pb-20">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Settings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage your account and preferences</p>
          </div>

          {/* Account Section */}
          {user && (
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account</p>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="text-sm font-medium text-foreground mt-1">{user.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium text-foreground mt-1">{user.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Preferences Section */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 pt-4 pb-2">Preferences</p>

            {/* Theme */}
            <button
              onClick={() => setIsThemeSheetOpen(true)}
              className="w-full h-12 px-4 py-3 flex items-center justify-between border-t border-border hover:bg-secondary/50 transition-colors"
            >
              <span className="text-sm font-medium text-foreground">Theme</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {THEME_OPTIONS.find(o => o.value === theme)?.label}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>

            {/* Notifications */}
            <button
              onClick={() => setIsNotificationSheetOpen(true)}
              className="w-full h-12 px-4 py-3 flex items-center justify-between border-t border-border hover:bg-secondary/50 transition-colors"
            >
              <span className="text-sm font-medium text-foreground">Notifications</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {NOTIFICATION_OPTIONS.find(o => o.value === notifications)?.label}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          </div>

          {/* Actions Section */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full mobile-button gap-2"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
            <Button
              variant="destructive"
              className="w-full mobile-button"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              Delete Account
            </Button>
          </div>
        </div>
      </PullToRefresh>

      {/* Bottom Sheets */}
      <BottomSheet
        isOpen={isThemeSheetOpen}
        onClose={() => setIsThemeSheetOpen(false)}
        title="Choose Theme"
        options={THEME_OPTIONS}
        value={theme}
        onChange={setTheme}
      />

      <BottomSheet
        isOpen={isNotificationSheetOpen}
        onClose={() => setIsNotificationSheetOpen(false)}
        title="Notification Preferences"
        options={NOTIFICATION_OPTIONS}
        value={notifications}
        onChange={setNotifications}
      />

      {/* Account Deletion Dialog */}
      <AccountDeletionDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onSuccess={handleDeleteSuccess}
      />
    </AppLayout>
  );
}