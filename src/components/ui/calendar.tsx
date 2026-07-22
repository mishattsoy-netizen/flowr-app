"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { 
  format, 
  addMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday 
} from "date-fns"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check } from 'lucide-react'

import { cn } from "@/lib/utils"

export type CalendarProps = {
  mode?: "single"
  selected?: Date
  selectedEndDate?: Date
  onSelect?: (date: Date | undefined) => void
  className?: string
  initialFocus?: boolean
}

export function Calendar({
  selected,
  selectedEndDate,
  onSelect,
  className,
  ...props
}: CalendarProps) {
  const [month, setMonth] = React.useState(selected || new Date())

  React.useEffect(() => {
    if (selected) {
      setMonth(selected);
    }
  }, [selected]);

  // Calculate days for the 7-column grid
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  })

  const dayHeaders = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
 
  return (
    <div className={cn("pl-3 pr-3 pt-3 pb-1.5 w-[240px] bg-transparent", className)}>
      {/* Header Navigation */}
      <div className="flex items-center justify-between w-full px-1 mb-2">
        <div className="flex items-center gap-1.5 font-ui text-[13px] font-semibold text-[var(--bone-100)]">
          <span>{format(month, "MMM")}</span>
          <Popover>
            <PopoverTrigger asChild>
              <button className="opacity-60 font-medium hover:opacity-100 transition-opacity cursor-pointer border-none bg-transparent outline-none">
                {format(month, "yyyy")}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[90px] p-1 bg-[var(--background-secondary)] bg-panel border border-[var(--bone-6)] shadow-[0_8px_30px_rgba(0,0,0,0.5)] rounded-[12px] z-[203] overflow-hidden" align="center">
              <div className="max-h-[200px] overflow-y-auto scrollbar-thin pr-1 flex flex-col gap-0.5">
                {Array.from({ length: 15 }).map((_, i) => {
                  const y = new Date().getFullYear() - 2 + i; // from 2 years ago to 12 years in future
                  const isSelected = month.getFullYear() === y;
                  return (
                    <button
                      key={y}
                      onClick={() => {
                        const newMonth = new Date(month);
                        newMonth.setFullYear(y);
                        setMonth(newMonth);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-[8px] cursor-pointer transition-colors border-none bg-transparent outline-none",
                        isSelected 
                          ? "bg-[var(--bone-15)] text-[var(--bone-100)] font-medium" 
                          : "text-[var(--bone-70)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-90)]"
                      )}
                    >
                      <span>{y}</span>
                      {isSelected && <Check className="w-3 h-3 text-[var(--bone-50)]" />}
                    </button>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        
        <div className="flex items-center gap-0.5">
          <button 
            type="button"
            onClick={() => {
              const today = new Date();
              setMonth(today);
              onSelect?.(today);
            }}
            className="h-6 px-2 flex items-center justify-center rounded-[6px] text-xs font-semibold text-[var(--bone-60)] hover:text-[var(--bone-100)] transition-all hover:bg-[var(--bone-10)] mr-1 cursor-pointer border-none bg-transparent outline-none"
          >
            Today
          </button>
          <button 
            type="button"
            onClick={() => setMonth(addMonths(month, -1))}
            className="h-6 w-6 flex items-center justify-center rounded-[6px] text-[var(--bone-60)] hover:text-[var(--bone-100)] transition-all hover:bg-[var(--bone-10)]"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          <button 
            type="button"
            onClick={() => setMonth(addMonths(month, 1))}
            className="h-6 w-6 flex items-center justify-center rounded-[6px] text-[var(--bone-60)] hover:text-[var(--bone-100)] transition-all hover:bg-[var(--bone-10)]"
          >
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
 
      {/* Day Headers Grid */}
      <div className="grid grid-cols-7 w-full mb-2">
        {dayHeaders.map(d => (
          <div key={d} className="text-[9px] uppercase font-ui-label text-[var(--bone-30)] font-bold text-center">
            {d}
          </div>
        ))}
      </div>
 
      {/* Calendar Days Grid */}
      <div 
        className="grid grid-cols-7 w-full gap-y-1 gap-x-0 relative select-none"
        onMouseLeave={() => {
          window.dispatchEvent(new CustomEvent('calendar-drag-end'));
        }}
      >
        {(() => {
          // Keep a component-level ref/state or window event listeners for dragging
          // We can use mouse events to coordinate range drawing
          return calendarDays.map((day) => {
            const isStart = selected && isSameDay(day, selected)
            const isEnd = selectedEndDate && isSameDay(day, selectedEndDate)
            const isSelected = isStart || isEnd
            
            const inRange = selected && selectedEndDate && 
              day > selected && 
              day < selectedEndDate &&
              !isSameDay(day, selected) &&
              !isSameDay(day, selectedEndDate)

            const isCurrentMonth = isSameMonth(day, monthStart)
            const isDayToday = isToday(day)
   
            return (
              <div 
                key={day.toString()} 
                className={cn(
                  "h-7 flex items-center justify-center relative",
                  inRange && "bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]",
                  isStart && selectedEndDate && "bg-gradient-to-r from-transparent to-[var(--brand-blue)]/10 rounded-l-[6px]",
                  isEnd && selected && "bg-gradient-to-l from-transparent to-[var(--brand-blue)]/10 rounded-r-[6px]"
                )}
              >
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect?.(day);
                    
                    // Determine if we're dragging a single date or drawing a range
                    const isRangeEnabled = !!selectedEndDate;

                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const target = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
                      const dayBtn = target?.closest('[data-calendar-day]');
                      if (dayBtn instanceof HTMLElement && dayBtn.dataset.calendarDay) {
                        const hoveredDate = new Date(dayBtn.dataset.calendarDay);
                        if (!isNaN(hoveredDate.getTime())) {
                          if (isRangeEnabled) {
                            // range dragging: start is original selection anchor, end is current hovered date (order by time value)
                            if (hoveredDate > day) {
                              window.dispatchEvent(new CustomEvent('calendar-drag-range', {
                                detail: { start: day, end: hoveredDate }
                              }));
                            } else {
                              window.dispatchEvent(new CustomEvent('calendar-drag-range', {
                                detail: { start: hoveredDate, end: day }
                              }));
                            }
                          } else {
                            // single date dragging: update start date only
                            window.dispatchEvent(new CustomEvent('calendar-drag-range', {
                              detail: { start: hoveredDate, end: undefined }
                            }));
                          }
                        }
                      }
                    };

                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };

                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                  data-calendar-day={day.toISOString()}
                  className={cn(
                    "h-7 w-7 flex items-center justify-center text-[12px] font-ui rounded-[6px] cursor-pointer z-10",
                    !isCurrentMonth && !isSelected && "text-[var(--bone-12)] hover:bg-[var(--bone-5)]",
                    isCurrentMonth && !isSelected && !inRange && "text-[var(--bone-100)] hover:bg-[var(--bone-10)]",
                    inRange && !isSelected && "hover:bg-[var(--brand-blue)]/20 font-medium",
                    isDayToday && !isSelected && "bg-[var(--bone-10)] text-[var(--bone-100)] font-bold",
                    isSelected && "bg-[var(--brand-blue)] text-white font-bold"
                  )}
                >
                  {format(day, "d")}
                </button>
              </div>
            )
          });
        })()}
      </div>
 

    </div>
  )
}
Calendar.displayName = "Calendar"

