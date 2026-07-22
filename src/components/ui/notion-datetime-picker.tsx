"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import { CalendarIcon, Clock, X, ChevronRight, ChevronDown, Check } from 'lucide-react'

import { Calendar } from "@/components/ui/calendar"
import { Toggle } from "@/components/ui/Toggle"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type NotionDateTimePickerProps = {
  startDate?: string
  setStartDate: (date: string | undefined) => void
  endDate?: string
  setEndDate: (date: string | undefined) => void
  includeTime?: boolean
  setIncludeTime: (include: boolean) => void
  reminder?: string
  setReminder: (reminder: string | undefined) => void
  isOverdue?: boolean
}

export function NotionDateTimePicker({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  includeTime,
  setIncludeTime,
  reminder,
  setReminder,
  isOverdue
}: NotionDateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  
  // Track which input is active: 'start' or 'end'
  const [activeInput, setActiveInput] = React.useState<'start' | 'end'>('start')
  
  // Parse strings to Date objects for the calendar
  const parsedStart = startDate ? new Date(startDate) : undefined;
  const parsedEnd = endDate ? new Date(endDate) : undefined;

  const [startText, setStartText] = React.useState("");
  const [endText, setEndText] = React.useState("");
  const [startTimeText, setStartTimeText] = React.useState("");
  const [endTimeText, setEndTimeText] = React.useState("");
  const startInputRef = React.useRef<HTMLInputElement>(null);
  const endInputRef = React.useRef<HTMLInputElement>(null);

  const currentYear = new Date().getFullYear();

  React.useEffect(() => {
    if (parsedStart) {
      const isCurrentYear = parsedStart.getFullYear() === currentYear;
      setStartText(format(parsedStart, isCurrentYear ? "MMM d" : "MMM d, yyyy"));
    } else {
      setStartText("");
    }
  }, [startDate, open]);

  React.useEffect(() => {
    if (parsedStart && includeTime) {
      setStartTimeText(format(parsedStart, "h:mm a"));
    } else {
      setStartTimeText("");
    }
  }, [startDate, open, includeTime]);

  React.useEffect(() => {
    if (parsedEnd && includeTime) {
      setEndTimeText(format(parsedEnd, "h:mm a"));
    } else {
      setEndTimeText("");
    }
  }, [endDate, open, includeTime]);

  React.useEffect(() => {
    const handleDragRange = (e: Event) => {
      const { start, end } = (e as CustomEvent).detail;
      const formatDateObj = (d: Date, existingStr?: string) => {
        const yearStr = d.getFullYear();
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getDate()).padStart(2, '0');
        
        if (includeTime && existingStr && existingStr.includes('T')) {
          const existingDate = new Date(existingStr);
          const hours = String(existingDate.getHours()).padStart(2, '0');
          const minutes = String(existingDate.getMinutes()).padStart(2, '0');
          return `${yearStr}-${monthStr}-${dayStr}T${hours}:${minutes}:00`;
        }
        return `${yearStr}-${monthStr}-${dayStr}`;
      };

      if (end === undefined) {
        // Single date dragging
        setStartDate(formatDateObj(start, startDate));
      } else {
        // Range dragging
        setStartDate(formatDateObj(start, startDate));
        setEndDate(formatDateObj(end, endDate));
      }
    };

    window.addEventListener('calendar-drag-range', handleDragRange);
    return () => {
      window.removeEventListener('calendar-drag-range', handleDragRange);
    };
  }, [startDate, endDate, includeTime, setStartDate, setEndDate]);

  React.useEffect(() => {
    if (parsedEnd) {
      const isCurrentYear = parsedEnd.getFullYear() === currentYear;
      setEndText(format(parsedEnd, isCurrentYear ? "MMM d" : "MMM d, yyyy"));
    } else {
      setEndText("");
    }
  }, [endDate, open]);

  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        if (activeInput === 'start') startInputRef.current?.focus();
        else endInputRef.current?.focus();
      }, 50);
    }
  }, [open, activeInput]);

  const handleDateInputBlur = (type: 'start' | 'end', text: string) => {
    const existing = type === 'start' ? startDate : endDate;
    if (!text.trim()) {
      if (type === 'start') setStartDate(undefined);
      else setEndDate(undefined);
      return;
    }
    
    // Parse text. If it doesn't contain a 4-digit year, assume current year
    let d = new Date(text);
    const hasFourDigitYear = /\b\d{4}\b/.test(text);
    if (!hasFourDigitYear && !isNaN(d.getTime())) {
      d.setFullYear(new Date().getFullYear());
    }

    if (!isNaN(d.getTime())) {
      const yearStr = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      
      let newStr = `${yearStr}-${monthStr}-${dayStr}`;
      if (includeTime && existing && existing.includes('T')) {
        const existingDate = new Date(existing);
        const hours = String(existingDate.getHours()).padStart(2, '0');
        const minutes = String(existingDate.getMinutes()).padStart(2, '0');
        newStr = `${yearStr}-${monthStr}-${dayStr}T${hours}:${minutes}:00`;
      }
      if (type === 'start') {
        setStartDate(newStr);
        if (hasEndDate && parsedEnd && d > parsedEnd) setEndDate(newStr);
      } else {
        setEndDate(newStr);
        if (parsedStart && d < parsedStart) setStartDate(newStr);
      }
    } else {
      // Revert if invalid
      if (type === 'start' && parsedStart) setStartText(format(parsedStart, "MMM d, yyyy"));
      else if (type === 'start') setStartText("");
      else if (type === 'end' && parsedEnd) setEndText(format(parsedEnd, "MMM d, yyyy"));
      else if (type === 'end') setEndText("");
    }
  };

  // Toggle End Date (enable/disable)
  const hasEndDate = !!endDate || activeInput === 'end';
  const toggleEndDate = (enabled: boolean) => {
    if (enabled) {
      setActiveInput('end');
      if (!endDate && startDate) {
        // default end date to same as start date if enabling
        setEndDate(startDate);
      }
    } else {
      setActiveInput('start');
      setEndDate(undefined);
    }
  }

  // Handle calendar selection
  const handleSelectDate = (date: Date | undefined) => {
    if (!date) return;
    
    // Create a new local string format for the date: YYYY-MM-DD
    const formatDateObj = (d: Date, existingStr?: string) => {
      const yearStr = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      
      if (includeTime && existingStr && existingStr.includes('T')) {
        const existingDate = new Date(existingStr);
        const hours = String(existingDate.getHours()).padStart(2, '0');
        const minutes = String(existingDate.getMinutes()).padStart(2, '0');
        return `${yearStr}-${monthStr}-${dayStr}T${hours}:${minutes}:00`;
      }
      return `${yearStr}-${monthStr}-${dayStr}`;
    };

    const newStr = formatDateObj(date, activeInput === 'start' ? startDate : endDate);

    if (activeInput === 'start') {
      setStartDate(newStr);
      if (hasEndDate && parsedEnd && date > parsedEnd) {
        setEndDate(newStr);
      }
      if (hasEndDate) {
        setActiveInput('end'); // Auto-advance to end date
      }
    } else {
      setEndDate(newStr);
      if (parsedStart && date < parsedStart) {
        setStartDate(newStr);
      }
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>, isStart: boolean) => {
    const val = e.target.value; // "HH:mm"
    if (!val) return;
    
    const [hours, minutes] = val.split(':').map(Number);
    const existingStr = isStart ? startDate : endDate;
    if (existingStr) {
      const d = new Date(existingStr);
      d.setHours(hours, minutes, 0, 0);
      if (isStart) setStartDate(d.toISOString());
      else setEndDate(d.toISOString());
    }
  };

  const getDisplayValue = () => {
    if (!parsedStart) return "Empty";
    
    const currentYear = new Date().getFullYear();
    
    const formatWithYearCheck = (dateObj: Date) => {
      const isCurrentYear = dateObj.getFullYear() === currentYear;
      const fmtStr = includeTime 
        ? (isCurrentYear ? "MMM d h:mm a" : "MMM d, yyyy h:mm a")
        : (isCurrentYear ? "MMM d" : "MMM d, yyyy");
      return format(dateObj, fmtStr);
    };

    let str = formatWithYearCheck(parsedStart);
    if (hasEndDate && parsedEnd) {
      str += " → " + formatWithYearCheck(parsedEnd);
    }
    return str;
  }

  const getTimeString = (dateStr?: string) => {
    if (!dateStr) return "00:00";
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center justify-between font-medium text-xs h-8 px-3 rounded-[6px] border-none transition-all text-left cursor-pointer outline-none focus:outline-none",
            !startDate ? "bg-[var(--bone-6)] text-[var(--bone-30)] hover:bg-[var(--bone-10)] focus:bg-[var(--bone-10)]" : "bg-[var(--bone-6)] hover:bg-[var(--bone-10)]"
          )}
        >
          <span className={cn("truncate", startDate && (isOverdue ? "text-red-400 font-medium" : "text-[var(--bone-90)]"))}>{getDisplayValue()}</span>
          {startDate && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setStartDate(undefined);
                setEndDate(undefined);
              }}
              className="w-4 h-4 flex items-center justify-center rounded-[4px] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-15)] transition-none"
            >
              <X className="w-2.5 h-2.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0 bg-[var(--background-secondary)] bg-panel border border-[var(--bone-6)] shadow-2xl rounded-[12px] z-[202] text-sm overflow-hidden" align="start">
        
        {/* Top Header Inputs */}
        <div className="p-3 pb-1 flex flex-col gap-2">
          {/* Start Date Input */}
          <div className={cn(
              "flex items-center w-full rounded-[6px] transition-colors border",
              activeInput === 'start'
                ? "border-[var(--brand-blue)] shadow-[0_0_0_0.5px_var(--brand-blue)] bg-[var(--bone-5)]"
                : "border-[var(--bone-10)] bg-transparent hover:bg-[var(--bone-5)]"
          )}>
            <input
              ref={startInputRef}
              type="text"
              placeholder="Empty"
              value={startText}
              onChange={(e) => setStartText(e.target.value)}
              onBlur={() => handleDateInputBlur('start', startText)}
              onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleDateInputBlur('start', startText); } }}
              onClick={() => {
                setActiveInput('start');
              }}
              className="w-full bg-transparent px-3 py-1.5 text-sm font-medium outline-none text-[var(--bone-90)] placeholder-[var(--bone-40)]"
            />
            {includeTime && (
              <>
                <div className="w-[1px] h-4 bg-[var(--bone-10)] mx-1 shrink-0" />
                <input
                  type="text"
                  placeholder="12:00 AM"
                  value={startTimeText}
                  onChange={(e) => setStartTimeText(e.target.value)}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (!val) return;
                    
                    // Parse "12:00 AM" or "12:00" or "5:00 PM"
                    const match = val.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/);
                    if (match) {
                      let hours = parseInt(match[1]);
                      const minutes = parseInt(match[2]);
                      const ampm = match[3]?.toUpperCase();
                      
                      if (ampm === 'PM' && hours < 12) hours += 12;
                      if (ampm === 'AM' && hours === 12) hours = 0;
                      
                      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
                        const existingStr = startDate;
                        if (existingStr) {
                          const d = new Date(existingStr);
                          d.setHours(hours, minutes, 0, 0);
                          setStartDate(d.toISOString());
                        }
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-[85px] bg-transparent px-2 py-1.5 text-sm font-medium outline-none text-[var(--bone-90)] text-center placeholder-[var(--bone-40)] border-none"
                />
              </>
            )}
          </div>

          {/* End Date Input */}
          {hasEndDate && (
            <div className={cn(
                "flex items-center w-full rounded-[6px] transition-colors border",
                activeInput === 'end'
                  ? "border-[var(--brand-blue)] shadow-[0_0_0_0.5px_var(--brand-blue)] bg-[var(--bone-5)]"
                  : "border-[var(--bone-10)] bg-transparent hover:bg-[var(--bone-5)]"
            )}>
              <input
                ref={endInputRef}
                type="text"
                placeholder="Empty"
                value={endText}
                onChange={(e) => setEndText(e.target.value)}
                onBlur={() => handleDateInputBlur('end', endText)}
                onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleDateInputBlur('end', endText); } }}
                onClick={() => {
                  setActiveInput('end');
                }}
                className="w-full bg-transparent px-3 py-1.5 text-sm font-medium outline-none text-[var(--bone-90)] placeholder-[var(--bone-40)]"
              />
              {includeTime && (
                <>
                  <div className="w-[1px] h-4 bg-[var(--bone-10)] mx-1 shrink-0" />
                  <input
                    type="text"
                    placeholder="12:00 AM"
                    value={endTimeText}
                    onChange={(e) => setEndTimeText(e.target.value)}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (!val) return;
                      
                      const match = val.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/);
                      if (match) {
                        let hours = parseInt(match[1]);
                        const minutes = parseInt(match[2]);
                        const ampm = match[3]?.toUpperCase();
                        
                        if (ampm === 'PM' && hours < 12) hours += 12;
                        if (ampm === 'AM' && hours === 12) hours = 0;
                        
                        if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
                          const existingStr = endDate;
                          if (existingStr) {
                            const d = new Date(existingStr);
                            d.setHours(hours, minutes, 0, 0);
                            setEndDate(d.toISOString());
                          }
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-[85px] bg-transparent px-2 py-1.5 text-sm font-medium outline-none text-[var(--bone-90)] text-center placeholder-[var(--bone-40)] border-none"
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="flex flex-col items-center justify-center pt-1 px-0 pb-0.5">
          <Calendar
            mode="single"
            selected={parsedStart}
            selectedEndDate={hasEndDate ? parsedEnd : undefined}
            onSelect={handleSelectDate}
            className="w-full"
            initialFocus
          />
        </div>

        <div className="border-t border-[var(--bone-6)] mx-2 mt-0.5" />

        {/* Toggles */}
        <div className="p-1.5 flex flex-col gap-0.5">
          <label className="flex items-center justify-between px-2 py-1 hover:bg-[var(--bone-5)] rounded-[6px] cursor-pointer">
            <span className="text-xs text-[var(--bone-70)] font-medium">End date</span>
            <Toggle checked={hasEndDate} onChange={toggleEndDate} className="scale-75" />
          </label>
          <label className="flex items-center justify-between px-2 py-1 hover:bg-[var(--bone-5)] rounded-[6px] cursor-pointer">
            <span className="text-xs text-[var(--bone-70)] font-medium">Include time</span>
            <Toggle checked={includeTime || false} onChange={setIncludeTime} className="scale-75" />
          </label>
          
          <div className="flex items-center justify-between px-2 py-1 hover:bg-[var(--bone-5)] rounded-[6px] cursor-pointer">
            <span className="text-xs text-[var(--bone-70)] font-medium">Remind</span>
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 opacity-60 font-semibold hover:opacity-100 transition-opacity cursor-pointer border-none bg-transparent outline-none text-xs text-[var(--bone-90)]">
                  <span>
                    {(() => {
                      switch (reminder) {
                        case "at_time": return "At time of event";
                        case "5m": return "5 mins before";
                        case "15m": return "15 mins before";
                        case "30m": return "30 mins before";
                        case "1h": return "1 hour before";
                        case "1d": return "1 day before";
                        default: return "None";
                      }
                    })()}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-60 text-[var(--bone-90)]" strokeWidth={2.5} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[140px] p-1 bg-[var(--background-secondary)] bg-panel border border-[var(--bone-6)] shadow-[0_8px_30px_rgba(0,0,0,0.5)] rounded-[12px] z-[203] overflow-hidden" align="end" alignOffset={-8} sideOffset={6}>
                <div className="flex flex-col gap-0.5">
                  {[
                    { val: "none", label: "None" },
                    { val: "at_time", label: "At time of event" },
                    { val: "5m", label: "5 mins before" },
                    { val: "15m", label: "15 mins before" },
                    { val: "30m", label: "30 mins before" },
                    { val: "1h", label: "1 hour before" },
                    { val: "1d", label: "1 day before" }
                  ].map((opt) => {
                    const isSelected = (reminder || "none") === opt.val;
                    return (
                      <button
                        key={opt.val}
                        onClick={() => {
                          setReminder(opt.val === "none" ? undefined : opt.val);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-[8px] cursor-pointer transition-colors border-none bg-transparent outline-none",
                          isSelected 
                            ? "bg-[var(--bone-15)] text-[var(--bone-100)] font-medium" 
                            : "text-[var(--bone-70)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-90)]"
                        )}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-3 h-3 text-[var(--bone-50)]" />}
                      </button>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Clear Button */}
        <div className="border-t border-[var(--bone-6)] mx-2" />
        <div className="p-1.5">
          <button
            onClick={() => {
              setStartDate(undefined);
              setEndDate(undefined);
              setOpen(false);
            }}
            className="w-full text-left px-2 py-1 text-xs font-medium text-[var(--bone-90)] hover:bg-[var(--bone-5)] rounded-[6px] transition-colors"
          >
            Clear
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
