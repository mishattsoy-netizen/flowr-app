"use client";

import { Info, RefreshCw } from 'lucide-react'

export default function UsagePanel() {
  return (
    <div className="space-y-8 text-[13px] text-bone-100 font-sans">
      
      {/* Header */}
      <div className="flex items-baseline gap-2 mb-2">
        <h3 className="text-[15px] font-semibold text-bone-100">Plan usage limits</h3>
        <span className="text-bone-70 text-[13px]">Pro</span>
      </div>

      {/* Current Session */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">Current session</h4>
            <div className="text-bone-70 mt-0.5">Resets in 4 hr 0 min</div>
          </div>
          <div className="flex items-center gap-4 w-[60%]">
            <div className="h-1.5 flex-1 bg-[var(--bone-3)] rounded-full overflow-hidden">
              <div className="h-full bg-[#ef4444] rounded-full w-full"></div>
            </div>
            <span className="text-bone-70 text-[12px] w-16 text-right">100% used</span>
          </div>
        </div>
      </div>

      {/* Weekly limits */}
      <div className="space-y-4 pt-6 border-t border-[#2e2e2e]">
        <h3 className="text-[15px] font-semibold text-bone-100">Weekly limits</h3>
        <a href="#" className="text-brand-blue hover:underline mb-2 block">Learn more about usage limits</a>

        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">All models</h4>
            <div className="text-bone-70 mt-0.5">Resets Mon 11:59 PM</div>
          </div>
          <div className="flex items-center gap-4 w-[60%]">
            <div className="h-1.5 flex-1 bg-[var(--bone-3)] rounded-full overflow-hidden">
              <div className="h-full bg-[#3b82f6] rounded-full w-[63%]"></div>
            </div>
            <span className="text-bone-70 text-[12px] w-16 text-right">63% used</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <h4 className="font-semibold">Fable</h4>
            <div className="text-bone-70 mt-0.5">Resets Mon 11:59 PM</div>
          </div>
          <div className="flex items-center gap-4 w-[60%]">
            <div className="h-1.5 flex-1 bg-[var(--bone-3)] rounded-full overflow-hidden">
              <div className="h-full bg-[#3b82f6] rounded-full w-[17%]"></div>
            </div>
            <span className="text-bone-70 text-[12px] w-16 text-right">17% used</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-bone-70 text-[12px] pt-4">
          Last updated: just now
          <RefreshCw className="w-3 h-3 cursor-pointer hover:text-bone-100 transition-colors" />
        </div>
      </div>

      {/* Usage credits */}
      <div className="space-y-5 pt-6 border-t border-[#2e2e2e]">
        <h3 className="text-[15px] font-semibold text-bone-100">Usage credits</h3>

        <div className="flex items-center justify-between">
          <div className="text-bone-100 font-medium">
            Turn on usage credits to keep using Claude if you hit a limit. <a href="#" className="text-brand-blue font-normal hover:underline">Learn more</a>
          </div>
          {/* Custom Toggle Switch */}
          <button className="w-9 h-5 rounded-full bg-[#3f3f3e] flex items-center p-0.5 transition-colors duration-200">
            <div className="w-4 h-4 rounded-full bg-[#8e8e8e] shadow-sm" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">€0.00 spent</h4>
            <div className="text-bone-70 mt-0.5 text-[12px]">Resets Aug 1</div>
          </div>
          <div className="flex items-center gap-4 w-[60%]">
            <div className="h-1.5 flex-1 bg-[var(--bone-3)] rounded-full overflow-hidden">
              <div className="h-full bg-[#3b82f6] rounded-full w-[0%]"></div>
            </div>
            <span className="text-bone-70 text-[12px] w-16 text-right">0% used</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="font-semibold">€20.00</h4>
              <Info className="w-3.5 h-3.5 text-bone-70" />
            </div>
            <div className="text-bone-70 mt-0.5 text-[12px]">Monthly spend limit</div>
          </div>
          <button className="px-3 py-1.5 rounded-md bg-[#2e2e2e] hover:bg-[#3f3f3e] transition-colors font-medium border border-[#3f3f3e]">
            Adjust limit
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 pb-4">
          <div>
            <h4 className="font-semibold">€0.00</h4>
            <div className="text-bone-70 mt-0.5 text-[12px] flex items-center gap-1">
              Current balance · Auto-reload <span className="bg-[#2e2e2e] px-1.5 rounded-[4px] text-[10px] uppercase font-bold tracking-wider text-bone-70 ml-1">Off</span>
            </div>
          </div>
          <button className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-md bg-[#2e2e2e] hover:bg-[#3f3f3e] transition-colors font-medium border border-[#3f3f3e]">
            Buy usage credits
            <span className="bg-[#1e3a8a] text-blue-200 px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider">Up to 30% off</span>
          </button>
        </div>
      </div>
    </div>
  )
}
