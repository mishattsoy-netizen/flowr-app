"use client";

import { useStore } from '@/data/store';
import { TelegramConnector } from '@/components/settings/TelegramConnector';
import { X, User, Monitor, Zap, Settings as SettingsIcon, Sparkles, FolderOpen, Sun, Moon, Trash2, Brain, Rocket } from 'lucide-react';
import { useEffect, useRef, useState, useCallback, type ComponentType } from 'react';
import { cn } from '@/lib/utils';
import ProfileSection from '@/components/profile/ProfileSection';
import UsagePanel from '@/components/settings/UsagePanel';
import { useAuth } from '@/components/AuthProvider';
import AISettingsSection from '@/components/settings/AISettingsSection';
import { useTheme } from '@/components/ThemeProvider';
import { ClearCacheButton } from '@/components/settings/SettingsPage';
import { Toggle } from '@/components/ui/Toggle';
import CapabilitiesPanel from '@/components/settings/CapabilitiesPanel';
import UpdatesSection from '@/components/settings/UpdatesSection';

export type SettingsTab = 'general' | 'account' | 'usage' | 'ai' | 'capabilities' | 'connectors' | 'updates';

export function SettingsModal() {
  const { modal, closeModal, openModal, interfaceSize, setInterfaceSize, isTabsHeaderVisible, toggleTabsHeader, isChatNewNoteButtonVisible, setChatNewNoteButtonVisible } = useStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  
  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (modal?.kind === 'settings') {
      if (modal.tab) setActiveTab(modal.tab as SettingsTab);
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [modal?.kind]);

  useEffect(() => {
    if (isVisible && modal?.kind === 'settings') {
      if (backdropRef.current) backdropRef.current.style.opacity = '1';
      if (modalRef.current) {
        modalRef.current.style.opacity = '1';
        const inverseScale = interfaceSize === 'small' ? 1.142857 : interfaceSize === 'big' ? 0.888888 : 1;
        modalRef.current.style.transform = `scale(${inverseScale}) translateY(0)`;
      }
    }
  }, [isVisible, modal?.kind, interfaceSize]);

  if (!isVisible) return null;

  const tabs: { id: SettingsTab; label: string; icon: ComponentType<{ className?: string, strokeWidth?: number }> }[] = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'account', label: 'Account', icon: User },
    { id: 'usage', label: 'Usage', icon: Zap },
    { id: 'ai', label: 'Flowr AI', icon: Sparkles },
    { id: 'capabilities', label: 'Capabilities', icon: Brain },
    { id: 'connectors', label: 'Connectors', icon: FolderOpen },
    { id: 'updates', label: "What's New", icon: Rocket },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 overflow-hidden">
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={closeModal}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 transition-all duration-300"
      />

      {/* Modal Content */}
      <div
        ref={modalRef}
        className="relative w-full max-w-4xl h-full max-h-[700px] bg-background rounded-[var(--radius-big)] border border-[#2e2e2e] overflow-hidden flex opacity-0 shadow-2xl transition-all"
      >
        {/* Sidebar */}
        <div className="w-[240px] flex-shrink-0 flex flex-col p-4 bg-background">
          <div className="px-2 pt-2 pb-4">
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-bone-70">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search settings..."
                className="w-full bg-[var(--bone-6)] border border-transparent hover:border-[var(--bone-12)] focus:border-[var(--brand-blue)] focus:shadow-[0_0_0_0.5px_var(--brand-blue)] rounded-md pl-9 pr-3 py-1.5 text-[13px] text-bone-100 placeholder:text-bone-70/50 outline-none transition-colors"
              />
            </div>
            <h2 className="text-[16px] font-medium tracking-tight text-bone-100">Settings</h2>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto scrollbar-none">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md group text-[14px]",
                    isActive
                      ? "bg-[#2b2a29] text-bone-100 font-medium"
                      : "text-bone-70 hover:text-bone-100 hover:bg-[#2b2a29]/50"
                  )}
                >
                  <Icon className={cn("w-[18px] h-[18px] shrink-0", isActive ? "text-bone-100" : "text-bone-70 group-hover:text-bone-100")} strokeWidth={1.5} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--app-panel)] relative border-l border-[#2e2e2e]">
          {/* Close Button */}
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={closeModal}
              className="p-1.5 rounded-md text-bone-70 hover:text-bone-100 hover:bg-[#3f3f3e] transition-colors"
            >
              <X strokeWidth={1.5} className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className={cn(
            "flex-1 px-12",
            activeTab === 'updates'
              ? "overflow-hidden flex flex-col min-h-0 pt-10 pb-2"
              : "overflow-y-auto scrollbar-none py-10 pt-16"
          )}>
            <div className={cn(
              "max-w-2xl w-full",
              activeTab === 'updates' && "flex-1 min-h-0 flex flex-col"
            )}>
              {activeTab === 'general' && (
                <div className="space-y-12">
                  <section>
                    <h3 className="text-[15px] font-semibold text-bone-100 mb-6">Preferences</h3>
                    
                    {/* Visual Theme */}
                    <div className="flex items-center justify-between py-4 border-b border-[#2e2e2e]">
                      <div>
                        <h4 className="text-[14px] font-medium text-bone-100">Appearance</h4>
                      </div>
                      <div className="relative flex items-center p-[2px] bg-[var(--slider-track)] rounded-[8px] w-[140px]">
                        <div
                          className="absolute top-[2px] bottom-[2px] rounded-[6px] bg-[var(--slider-pill)] transition-all duration-300 ease-out shadow-[var(--slider-pill-shadow)]"
                          style={{
                            width: 'calc((100% - 4px) / 3)',
                            left: `calc(2px + (${
                              (!isMounted || theme === 'system') ? 0 : (theme === 'light' ? 1 : 2)
                            } * (100% - 4px) / 3))`
                          }}
                        />
                        <button
                          onClick={() => setTheme('system')}
                          className={cn(
                            "relative z-10 flex-1 px-3 py-1.5 rounded-[7px] transition-colors flex items-center justify-center",
                            (!isMounted || theme === 'system') ? "text-bone-100" : "text-bone-70 hover:text-bone-100"
                          )}
                          title="System"
                        >
                          <Monitor className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => setTheme('light')}
                          className={cn(
                            "relative z-10 flex-1 px-3 py-1.5 rounded-[7px] transition-colors flex items-center justify-center",
                            (isMounted && theme === 'light') ? "text-bone-100" : "text-bone-70 hover:text-bone-100"
                          )}
                          title="Light"
                        >
                          <Sun className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => setTheme('dark')}
                          className={cn(
                            "relative z-10 flex-1 px-3 py-1.5 rounded-[7px] transition-colors flex items-center justify-center",
                            (isMounted && theme === 'dark') ? "text-bone-100" : "text-bone-70 hover:text-bone-100"
                          )}
                          title="Dark"
                        >
                          <Moon className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>

                    {/* Interface Scaling */}
                    <div className="flex items-center justify-between py-4 border-b border-[#2e2e2e]">
                      <div>
                        <h4 className="text-[14px] font-medium text-bone-100">Interface Scaling</h4>
                      </div>
                      <div className="relative flex items-center p-[2px] bg-[var(--slider-track)] rounded-[8px] w-[240px]">
                        <div
                          className="absolute top-[2px] bottom-[2px] rounded-[6px] bg-[var(--slider-pill)] transition-all duration-300 ease-out shadow-[var(--slider-pill-shadow)]"
                          style={{
                            width: 'calc((100% - 4px) / 3)',
                            left: `calc(2px + (${
                              interfaceSize === 'small' ? 0 : interfaceSize === 'regular' ? 1 : 2
                            } * (100% - 4px) / 3))`
                          }}
                        />
                        {['small', 'regular', 'big'].map((size) => (
                          <button
                            key={size}
                            onClick={() => setInterfaceSize(size as 'small' | 'regular' | 'big')}
                            className={cn(
                              "relative z-10 flex-1 px-2 py-1.5 rounded-[7px] text-[13px] font-medium capitalize transition-colors text-center",
                              interfaceSize === size ? "text-bone-100" : "text-bone-70 hover:text-bone-100"
                            )}
                          >
                            {size === 'regular' ? 'Default' : size}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tabs Navigation */}
                    <div className="flex items-center justify-between py-4 border-b border-[#2e2e2e]">
                      <div>
                        <h4 className="text-[14px] font-medium text-bone-100">Tabs Navigation</h4>
                      </div>
                      <Toggle
                        checked={isTabsHeaderVisible}
                        onChange={() => toggleTabsHeader()}
                      />
                    </div>

                    {/* Chat Action Button */}
                    <div className="flex items-center justify-between py-4 border-b border-[#2e2e2e]">
                      <div>
                        <h4 className="text-[14px] font-medium text-bone-100">Chat 'New Note' Button</h4>
                        <p className="text-[13px] text-bone-70 mt-0.5">Show the quick action button under AI messages.</p>
                      </div>
                      <Toggle
                        checked={isChatNewNoteButtonVisible}
                        onChange={(checked) => setChatNewNoteButtonVisible(checked)}
                      />
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'account' && (
                <div className="space-y-12">
                  <section>
                    <h3 className="text-[15px] font-semibold text-bone-100 mb-6">Profile</h3>
                    <ProfileSection />
                  </section>

                  <section>
                    <h3 className="text-[15px] font-semibold text-bone-100 mb-6">Data</h3>
                    {/* Clear Local Cache */}
                    <div className="flex items-center justify-between py-4 border-b border-[#2e2e2e]">
                      <div>
                        <h4 className="text-[14px] font-medium text-bone-100">Local Cache</h4>
                      </div>
                      <ClearCacheButton />
                    </div>

                    {/* Delete All Data */}
                    <div className="flex items-center justify-between py-4">
                      <div>
                        <h4 className="text-[14px] font-medium text-bone-100">Delete All Data</h4>
                        <p className="text-[13px] text-bone-70 mt-0.5 max-w-sm">
                          Permanently removes all entities, tasks, conversations, shortcuts, and the entire workspace. Cannot be undone.
                        </p>
                      </div>
                      <button
                        onClick={() => openModal({ kind: 'deleteAllDataConfirm' })}
                        className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium bg-red-500/5 border border-red-500/10 text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Everything
                      </button>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'usage' && (
                <div className="py-2">
                  <UsagePanel />
                </div>
              )}

              {activeTab === 'ai' && (
                <div className="space-y-12">
                  <section>
                    <h3 className="text-[15px] font-semibold text-bone-100 mb-6">Flowr AI</h3>
                    <AISettingsSection />
                  </section>
                </div>
              )}

              {activeTab === 'capabilities' && (
                <div className="py-2">
                  <CapabilitiesPanel />
                </div>
              )}

              {activeTab === 'updates' && (
                <div className="flex-1 min-h-0 flex flex-col">
                  <h3 className="text-[15px] font-semibold text-bone-100 mb-4 shrink-0">What&apos;s New</h3>
                  <UpdatesSection />
                </div>
              )}

              {activeTab === 'connectors' && (
                <div className="space-y-12">
                  <section>
                    <h3 className="text-[15px] font-semibold text-bone-100 mb-6">Connectors</h3>
                    <div className="space-y-4">
                      <TelegramConnector />
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
