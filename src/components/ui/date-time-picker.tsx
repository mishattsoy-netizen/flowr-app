"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon, Clock, X } from 'lucide-react'

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function DatePickerTime({ 
  date, 
  setDate,
  time,
  setTime,
  className,
  hideLabels,
  hideTime
}: { 
  date?: Date, 
  setDate?: (date: Date | undefined) => void,
  time?: string,
  setTime?: (time: string) => void,
  className?: string,
  hideLabels?: boolean,
  hideTime?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(date)

  const activeDate = date || internalDate
  const handleSelect = setDate || setInternalDate

  return (
    <FieldGroup className={cn("flex-row items-end gap-2", className)}>
      <Field className="flex-1">
        {!hideLabels && <FieldLabel htmlFor="date-picker">Date</FieldLabel>}
        <div className="relative w-full">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                id="date-picker"
                className={cn(
                  "w-full flex items-center font-medium text-xs h-8 pl-3 pr-8 rounded-[6px] border-none bg-[var(--bone-6)] hover:bg-[var(--bone-10)] focus:bg-[var(--bone-10)] transition-all text-left cursor-pointer outline-none focus:outline-none",
                  !activeDate && "text-[var(--bone-30)]",
                  activeDate && "text-[var(--bone-90)]"
                )}
              >
                <span className="truncate">
                  {activeDate ? format(activeDate, "dd/MM/yyyy") : "dd/mm/yyyy"}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-panel border border-[var(--bone-6)] shadow-2xl rounded-[12px] backdrop-blur-3xl z-[202]" align="start">
              <Calendar
                mode="single"
                selected={activeDate}
                onSelect={(d) => {
                  handleSelect(d)
                  setOpen(false)
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {activeDate && (
            <span
              onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setOpen(false);
                handleSelect(undefined);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-[4px] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-15)] transition-none shrink-0 cursor-pointer z-20"
            >
              <X className="w-2.5 h-2.5" />
            </span>
          )}
        </div>
      </Field>
      {!hideTime && (
        <Field className="w-[140px]">
          {!hideLabels && <FieldLabel htmlFor="time-picker">Time</FieldLabel>}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                id="time-picker"
                className={cn(
                  "w-full justify-between font-medium text-xs h-8 px-3 rounded-[6px] border-none bg-[var(--bone-6)] hover:bg-[var(--bone-10)] transition-all",
                  !time && "text-[var(--bone-30)]",
                  time && "text-[var(--bone-90)]"
                )}
              >
                <span className="truncate">{time || "Time"}</span>
                <Clock className="w-3.5 h-3.5 opacity-40 shrink-0 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-0" align="end">
              <div className="flex h-64">
                <div className="flex-1 overflow-y-auto scrollbar-none p-1 border-r border-[var(--bone-10)]">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                    <button
                      key={h}
                      onClick={() => {
                        const [_, m, p] = (time || "12:00 AM").split(/[: ]/)
                        setTime?.(`${h.toString().padStart(2, '0')}:${m} ${p}`)
                      }}
                      className={cn(
                        "w-full px-2 py-1.5 text-sm rounded-md text-left transition-colors",
                        time?.startsWith(h.toString().padStart(2, '0')) 
                          ? "bg-accent/10 border border-accent/30 text-accent font-semibold" 
                          : "text-[var(--bone-70)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-100)]"
                      )}
                    >
                      {h.toString().padStart(2, '0')}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-none p-1 border-r border-[var(--bone-10)]">
                  {["00", "15", "30", "45"].map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        const [h, _, p] = (time || "12:00 AM").split(/[: ]/)
                        setTime?.(`${h}:${m} ${p}`)
                      }}
                      className={cn(
                        "w-full px-2 py-1.5 text-sm rounded-md text-left transition-colors",
                        time?.includes(`:${m}`) 
                          ? "bg-accent/10 border border-accent/30 text-accent font-semibold" 
                          : "text-[var(--bone-70)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-100)]"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-none p-1">
                  {["AM", "PM"].map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        const [h, m, _] = (time || "12:00 AM").split(/[: ]/)
                        setTime?.(`${h}:${m} ${p}`)
                      }}
                      className={cn(
                        "w-full px-2 py-1.5 text-sm rounded-md text-left transition-colors",
                        time?.endsWith(p) 
                          ? "bg-accent/10 border border-accent/30 text-accent font-semibold" 
                          : "text-[var(--bone-70)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-100)]"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </Field>
      )}
    </FieldGroup>
  )
}
