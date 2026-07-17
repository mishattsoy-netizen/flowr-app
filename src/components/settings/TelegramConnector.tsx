"use client";

import { useEffect, useState } from 'react';
import { getTelegramConnectionStatus, unlinkTelegramAccount } from '@/app/auth/telegram-link/actions';

export function TelegramConnector() {
  const [status, setStatus] = useState<{ connected: boolean; telegramId?: number; username?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTelegramConnectionStatus().then(res => {
      setStatus(res);
      setLoading(false);
    });
  }, []);

  const handleUnlink = async () => {
    if (!status?.telegramId) return;
    setLoading(true);
    const res = await unlinkTelegramAccount(status.telegramId);
    if (res.success) {
      setStatus({ connected: false });
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="p-4 rounded-2xl bg-[var(--app-dark)] animate-pulse">
        <div className="h-4 bg-[var(--bone-10)] rounded w-1/4 mb-2"></div>
        <div className="h-3 bg-[var(--bone-10)] rounded w-1/2"></div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-[var(--app-dark)] flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-[#24A1DE]/10 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-[#24A1DE]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
        </div>
        <div>
          <h4 className="text-[14px] font-medium text-bone-100 flex items-center gap-2">
            Telegram
            {status?.connected && (
              <span className="px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider">
                Connected
              </span>
            )}
          </h4>
          <p className="text-[13px] text-bone-70 mt-0.5 max-w-md leading-relaxed">
            {status?.connected ? (
              <>
                Connected to account <span className="text-bone-100 font-medium">@{status.username || status.telegramId}</span>
              </>
            ) : (
              <>
                Search for <strong>@Flowr_App_Bot</strong> on Telegram and send <code>/link</code> to connect.
              </>
            )}
          </p>
        </div>
      </div>
      
      {status?.connected && (
        <button
          onClick={handleUnlink}
          disabled={loading}
          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded text-[12px] font-medium transition-colors shrink-0"
        >
          Disconnect
        </button>
      )}
    </div>
  );
}
