"use client";

import { useStore, SettingsTab } from '@/data/store';
import { X, User, Monitor, Zap, Settings as SettingsIcon, LucideIcon, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';













export function SettingsModal() {
  const { modal, closeModal, theme, toggleTheme, interfaceSize, setInterfaceSize } = useStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('interface');
  const [isVisible, setIsVisible] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (modal?.kind === 'settings') {
      if (modal.tab) setActiveTab(modal.tab);
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
        modalRef.current.style.transform = 'scale(1) translateY(0)';
      }
    }
  }, [isVisible, modal?.kind]);

  if (!isVisible) return null;

  const tabs: { id: SettingsTab | 'admin'; label: string; icon: LucideIcon }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'interface', label: 'Interface', icon: Monitor },
    { id: 'account', label: 'Account', icon: SettingsIcon },
    { id: 'admin', label: 'Admin Suite', icon: ShieldCheck },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 overflow-hidden">
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={closeModal}
        className="absolute inset-0 bg-black/40 opacity-0"
      />

      {/* Modal Content */}
      <div
        ref={modalRef}
        className="relative w-full max-w-5xl h-full max-h-[800px] bg-[var(--color-panel)] rounded-[var(--radius-medium)] overflow-hidden flex opacity-0"
      >
        {/* Sidebar */}
        <div className="w-64 border-r border-border flex flex-col p-6 bg-sidebar/50">
          <div className="flex items-center gap-2 mb-8 px-2">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <SettingsIcon className="w-4 h-4 text-accent" />
            </div>
            <h2 className="text-xl font-display tracking-tight">Settings</h2>
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
                  className={clsx(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-medium)] group text-[15px]",
                    isActive
                      ? "bg-white/10 text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <Icon strokeWidth={2} className={clsx("w-5 h-5", isActive ? "text-accent" : "text-muted-foreground group-hover:text-foreground")} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Version Info */}
          <div className="pt-4 border-t border-border mt-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest text-center">Flowr 4.4.1 - Build 2304</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-background/20">
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-8 border-b border-border bg-white/5">
            <div className="flex items-center gap-2">
               <h3 className="font-display text-lg capitalize">{activeTab}</h3>
            </div>
            <button
              onClick={closeModal}
              className="p-2 rounded-full hover:bg-hover text-muted-foreground hover:text-foreground"
            >
              <X strokeWidth={2} className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-8 scrollbar-none">
            <div className="max-w-2xl mx-auto">
              {activeTab === 'interface' && (
                <div className="space-y-10">
                  {/* Theme Section */}
                  <section>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Visual Theme</h4>
                    <p className="text-sm text-muted-foreground mb-6">Choose an aesthetic that fits your focus.</p>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => theme === 'light' && toggleTheme()}
                        className={clsx(
                          "group relative flex flex-col items-center gap-4 p-4 rounded-2xl border",
                          theme === 'dark' ? "border-accent bg-accent/5 ring-1 ring-accent/20" : "border-border bg-white/5 hover:border-muted-foreground/30"
                        )}
                      >
                        <div className="w-full aspect-video bg-[#0D0D0C] rounded-lg border border-white/10 overflow-hidden p-3 flex flex-col gap-2">
                          <div className="h-2 w-1/3 bg-accent/30 rounded-full" />
                          <div className="space-y-1.5">
                            <div className="h-1.5 w-full bg-white/10 rounded-full" />
                            <div className="h-1.5 w-2/3 bg-white/10 rounded-full" />
                          </div>
                          <div className="mt-auto h-2 w-1/4 bg-white/5 rounded-full" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={clsx("text-sm font-medium", theme === 'dark' ? "text-accent" : "text-foreground")}>Dark Stealth</span>
                          {theme === 'dark' && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                        </div>
                      </button>

                      <button
                        onClick={() => theme === 'dark' && toggleTheme()}
                        className={clsx(
                          "group relative flex flex-col items-center gap-4 p-4 rounded-2xl border",
                          theme === 'light' ? "border-accent bg-accent/5 ring-1 ring-accent/20" : "border-border bg-white/5 hover:border-muted-foreground/30"
                        )}
                      >
                        <div className="w-full aspect-video bg-[#F8F7F7] rounded-lg border border-black/5 overflow-hidden p-3 flex flex-col gap-2">
                          <div className="h-2 w-1/3 bg-accent/30 rounded-full" />
                          <div className="space-y-1.5">
                            <div className="h-1.5 w-full bg-black/10 rounded-full" />
                            <div className="h-1.5 w-2/3 bg-black/10 rounded-full" />
                          </div>
                          <div className="mt-auto h-2 w-1/4 bg-black/5 rounded-full" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={clsx("text-sm font-medium", theme === 'light' ? "text-accent" : "text-foreground")}>Light Bloom</span>
                          {theme === 'light' && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                        </div>
                      </button>
                    </div>
                  </section>

                  {/* Scale Section */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Interface Scaling</h4>
                        <p className="text-sm text-muted-foreground mt-1">Adjust the overall size of the UI components.</p>
                      </div>
                      <span className="px-2 py-1 rounded bg-accent/10 border border-accent/20 text-[10px] font-bold text-accent uppercase tracking-tighter">New</span>
                    </div>

                    <div className="relative flex p-1.5 bg-sidebar/50 rounded-2xl border border-border">
                      {['small', 'regular', 'big'].map((size) => (
                        <button
                          key={size}
                          onClick={() => setInterfaceSize(size as 'small' | 'regular' | 'big')}
                          className={clsx(
                            "relative flex-1 py-3 px-4 rounded-xl text-[13px] font-medium capitalize z-10",
                            interfaceSize === size
                              ? "text-accent"
                              : "text-muted-foreground/70 hover:text-foreground"
                          )}
                        >
                          {interfaceSize === size && (
                            <div
                              className="absolute inset-0 bg-accent/10 border border-accent/30 rounded-xl -z-10"
                            />
                          )}
                          {size}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-between px-2 text-[10px] text-muted-foreground font-medium">
                      <span>85% scale</span>
                      <span>Default (100%)</span>
                      <span>115% scale</span>
                    </div>
                  </section>
                </div>
              )}


              {activeTab !== 'interface' && activeTab !== 'admin' && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-20 h-20 rounded-[24px] bg-accent/5 border border-accent/10 flex items-center justify-center mb-6 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent opacity-0 group-hover:opacity-100" />
                    <Zap strokeWidth={2} className="w-10 h-10 text-accent/60 relative z-10" />
                  </div>
                  <h4 className="text-2xl font-display mb-2">{tabs.find(t => t.id === activeTab)?.label} Settings</h4>
                  <p className="text-muted-foreground/80 max-max-w-sm text-[15px] leading-relaxed">
                    This module is currently being optimized for high-fidelity performance. Stay tuned for a seamless experience.
                  </p>
                  <button
                    onClick={() => setActiveTab('interface')}
                    className="mt-8 px-6 py-2.5 rounded-full bg-white/5 border border-border text-sm font-medium hover:bg-white/10 hover:border-muted-foreground/30"
                  >
                    Return to Interface
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
