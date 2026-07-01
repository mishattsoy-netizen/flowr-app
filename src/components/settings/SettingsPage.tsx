"use client";

import { useStore, SettingsTab } from '@/data/store';
import { User, Monitor, Settings as SettingsIcon, ShieldCheck, Zap, Sun, Moon, Sparkles, Trash2, RefreshCw, ArrowLeft, X } from 'lucide-react';
import { useState, useCallback, useEffect, type ComponentType } from 'react';
import { cn } from '@/lib/utils';
import ProfileSection from '@/components/profile/ProfileSection';
import { useAuth } from '@/components/AuthProvider';
import { Toggle } from '@/components/ui/Toggle';
import { useTheme } from '@/components/ThemeProvider';
import UpdatesSection from '@/components/settings/UpdatesSection';
import AISettingsSection from '@/components/settings/AISettingsSection';
import { AIAvatar } from '@/components/assistant/components/AIAvatar';
import { isDesktop } from '@/lib/env';
import { FolderOpen } from 'lucide-react';

export function SettingsPage() {
  const { interfaceSize, setInterfaceSize, isTabsHeaderVisible, toggleTabsHeader, goBack } = useStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const [activeTab, setActiveTab] = useState<SettingsTab>('interface');
  const { isAdmin } = useAuth();

  const [vaultPath, setVaultPath] = useState<string | null>(null);

  useEffect(() => {
    if (isDesktop()) {
      import('@/lib/fileVault').then(({ getVaultPath }) => {
        getVaultPath().then(path => setVaultPath(path));
      });
    }
  }, []);

  const handleChangeVault = async () => {
    const { pickVaultFolder } = await import('@/lib/fileVault');
    const path = await pickVaultFolder();
    if (path) setVaultPath(path);
  };

  const tabs: { id: SettingsTab | 'admin'; label: string; icon: ComponentType<{ className?: string }> }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'interface', label: 'Interface', icon: Monitor },
    { id: 'account', label: 'Account', icon: SettingsIcon },
    { id: 'ai', label: 'AI', icon: AIAvatar },
    { id: 'updates', label: "What's New", icon: Sparkles },
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin Suite', icon: ShieldCheck }] : []),
  ];

  if (activeTab === 'admin' && !isAdmin) {
    setActiveTab('interface');
  }

  const activeThemeIndex = isMounted
    ? (theme === 'light' ? 1 : theme === 'dark' ? 2 : 0)
    : 0;

  const activeSizeIndex = isMounted
    ? (interfaceSize === 'regular' ? 1 : interfaceSize === 'big' ? 2 : 0)
    : 1;

  return (
    <div className="flex-1 flex overflow-hidden h-full bg-[var(--color-bg)]">
      {/* Settings Sub-Sidebar */}
      <div className="w-64 border-r border-[var(--bone-10)] flex flex-col p-6 bg-sidebar/30 shrink-0">
        <div className="flex items-center justify-between mb-8 px-2">
          <h2 className="text-xl font-display font-semibold tracking-tight text-[var(--bone-100)]">Settings</h2>
          <button
            onClick={() => goBack()}
            className="p-1 rounded-md hover:bg-[var(--bone-6)] text-[var(--bone-60)] hover:text-[var(--bone-100)] transition-colors cursor-pointer"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'admin') {
                    window.location.href = '/admin';
                    return;
                  }
                  setActiveTab(tab.id as SettingsTab);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-medium)] group text-[14px] font-medium transition-all text-left",
                  isActive
                    ? "bg-[var(--bone-10)] text-[var(--bone-100)] font-semibold"
                    : "text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
                )}
              >
                <Icon className={cn("w-4 h-4 transition-colors", "shrink-0", isActive ? "text-[var(--bone-100)]" : "text-[var(--bone-70)] group-hover:text-[var(--bone-100)]")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Version Info */}
        <div className="pt-4 border-t border-[var(--bone-6)] mt-4">
          <p className="text-[10px] text-[var(--bone-30)] uppercase tracking-widest text-center font-mono">Flowr Beta 1.0.8 - Build 1008</p>
        </div>
      </div>

      {/* Main Settings Content */}
      <div className={cn("flex-1 flex flex-col min-w-0 bg-transparent", activeTab !== 'updates' && "overflow-y-auto")}>
        <div className={cn("flex-1 max-w-4xl w-full mx-auto px-8 md:px-12", activeTab === 'updates' ? "pt-10 pb-0 flex flex-col min-h-0 h-full" : "py-10")}>
          <div className="mb-8 pb-4 border-b border-[var(--bone-6)] shrink-0">
            <h3 className="font-display text-2xl font-bold tracking-tight text-[var(--bone-100)] capitalize">{activeTab}</h3>
            <p className="text-sm text-[var(--bone-70)] mt-1">
              {activeTab === 'profile' && "Manage your visual presentation and account identity."}
              {activeTab === 'interface' && "Customize visual theme, scale, and layout preferences."}
              {activeTab === 'account' && "Manage your workspace and credentials settings."}
              {activeTab === 'ai' && "Configure AI behavior, personal preferences, and memory settings."}
              {activeTab === 'updates' && "Stay up to date with the latest additions, improvements, and fixes."}
            </p>
          </div>

          <div className={cn(activeTab === 'updates' ? "flex-1 min-h-0" : "space-y-10")}>
            {activeTab === 'interface' && (
              <div className="space-y-10">
                {/* Appearance/Theme Section */}
                <section className="flex items-center justify-between py-1 max-w-2xl">
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--bone-100)]">Appearance</h4>
                    <p className="text-xs text-[var(--bone-70)] mt-0.5">Customize the visual tone of your workspace.</p>
                  </div>
                  <div className="relative flex items-center p-[4px] bg-[var(--slider-track)] rounded-[10px] w-[280px] h-[36px] shrink-0 select-none">
                    {/* Sliding Pill */}
                    {isMounted && (
                      <div
                        className="absolute top-[4px] bottom-[4px] rounded-[7px] bg-[var(--slider-pill)] transition-all duration-300 ease-out"
                        style={{
                          width: 'calc((100% - 8px) / 3)',
                          left: `calc(4px + (${activeThemeIndex} * (100% - 8px) / 3))`,
                          boxShadow: 'var(--slider-pill-shadow)'
                        }}
                      />
                    )}
                    {[
                      { id: 'system', icon: Monitor, label: 'System' },
                      { id: 'light', icon: Sun, label: 'Light' },
                      { id: 'dark', icon: Moon, label: 'Dark' }
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const isActive = isMounted ? (theme === opt.id) : (opt.id === 'system');
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setTheme(opt.id as 'system' | 'light' | 'dark')}
                          className={cn(
                            "relative z-10 flex-1 flex items-center justify-center gap-1.5 h-full rounded-[7px] transition-colors duration-300 font-semibold text-[11px] tracking-wide",
                            isActive 
                              ? "text-[var(--bone-100)]" 
                              : "text-[var(--bone-40)] hover:text-[var(--bone-100)]"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Scale Section */}
                <section className="border-t border-[var(--bone-6)] pt-8 flex items-center justify-between max-w-2xl">
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--bone-100)]">Interface Scaling</h4>
                    <p className="text-xs text-[var(--bone-70)] mt-0.5">Adjust the overall size of the UI components.</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="relative flex items-center p-[4px] bg-[var(--slider-track)] rounded-[10px] w-[280px] h-[36px] shrink-0 select-none">
                      {/* Sliding Pill */}
                      {isMounted && (
                        <div
                          className="absolute top-[4px] bottom-[4px] rounded-[7px] bg-[var(--slider-pill)] transition-all duration-300 ease-out"
                          style={{
                            width: 'calc((100% - 8px) / 3)',
                            left: `calc(4px + (${activeSizeIndex} * (100% - 8px) / 3))`,
                            boxShadow: 'var(--slider-pill-shadow)'
                          }}
                        />
                      )}
                      {['small', 'regular', 'big'].map((size) => {
                        const isActive = isMounted ? (interfaceSize === size) : (size === 'regular');
                        return (
                          <button
                            key={size}
                            onClick={() => setInterfaceSize(size as 'small' | 'regular' | 'big')}
                            className={cn(
                              "relative z-10 flex-1 flex items-center justify-center h-full rounded-[7px] transition-colors duration-300 font-semibold text-[11px] tracking-wide capitalize",
                              isActive
                                ? "text-[var(--bone-100)]"
                                : "text-[var(--bone-40)] hover:text-[var(--bone-100)]"
                            )}
                          >
                            <span>{size}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-3 w-[280px] px-[4px] text-[9px] text-[var(--bone-40)] font-semibold uppercase tracking-wider text-center">
                      <span>85% scale</span>
                      <span>Default (100%)</span>
                      <span>115% scale</span>
                    </div>
                  </div>
                </section>

                {/* Tabs Header Section */}
                <section className="border-t border-[var(--bone-6)] pt-8">
                  <div className="flex items-center justify-between max-w-md">
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--bone-40)] uppercase tracking-widest">Tabs Header</h4>
                      <p className="text-sm text-[var(--bone-70)] mt-1">Show or hide the tabs navigation bar.</p>
                    </div>
                    <Toggle
                      checked={isTabsHeaderVisible}
                      onChange={() => toggleTabsHeader()}
                      size="sm"
                    />
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="bg-transparent rounded-2xl">
                <ProfileSection />
              </div>
            )}

            {activeTab === 'account' && (
              <div className="space-y-10">
                {/* Local Directory (Vault) (Desktop only) */}
                {isDesktop() && (
                  <section className="flex items-center justify-between py-1 max-w-2xl">
                    <div className="min-w-0 flex-1 pr-4">
                      <h4 className="text-sm font-semibold text-[var(--bone-100)]">Local Directory (Vault)</h4>
                      <p className="text-xs text-[var(--bone-70)] mt-0.5 truncate max-w-md">
                        {vaultPath ? vaultPath : 'No local directory selected.'}
                      </p>
                    </div>
                    <button
                      onClick={handleChangeVault}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--bone-6)] border border-[var(--bone-10)] text-[var(--bone-90)] hover:bg-[var(--bone-10)] transition-all shrink-0 cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Change Directory
                    </button>
                  </section>
                )}

                {/* Clear Local Cache */}
                <section className={cn(
                  "flex items-center justify-between py-1 max-w-2xl",
                  isDesktop() && "border-t border-[var(--bone-6)] pt-8"
                )}>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--bone-100)]">Local Cache</h4>
                    <p className="text-xs text-[var(--bone-70)] mt-0.5">
                      Clears locally stored data (tasks, notes, canvases) and reloads fresh from the cloud.
                    </p>
                  </div>
                  <ClearCacheButton />
                </section>
              </div>
            )}
            {activeTab === 'ai' && <AISettingsSection />}
            {activeTab === 'updates' && <UpdatesSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClearCacheButton() {
  const [cleared, setCleared] = useState(false);

  const handleClear = useCallback(() => {
    try {
      localStorage.removeItem('flowr-storage');
      setCleared(true);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (e) {
      console.error('[Settings] Failed to clear cache:', e);
    }
  }, []);

  return (
    <button
      onClick={handleClear}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all shrink-0",
        cleared
          ? "bg-green-500/10 text-green-500 border border-green-500/20"
          : "bg-red-500/5 border border-red-500/10 text-red-400 hover:bg-red-500/10 hover:border-red-500/20"
      )}
    >
      {cleared ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Refreshing...
        </>
      ) : (
        <>
          <Trash2 className="w-3.5 h-3.5" />
          Clear Cache & Reload
        </>
      )}
    </button>
  );
}
