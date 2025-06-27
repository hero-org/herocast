import * as React from "react"
import { CalendarIcon, ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { format, startOfToday, isToday, isBefore, startOfMinute } from "date-fns"
import { today as todayTz, getLocalTimeZone } from '@internationalized/date'

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from '@/lib/utils'

type DateTimePickerProps = {
  jsDate?: Date | null
  onJsDateChange?: (date: Date | null) => void
  showClearButton?: boolean
  granularity?: string
  hourCycle?: number
  disabled?: boolean
}

type TimePreset = {
  label: string
  hour: number
  minute: number
  description: string
}

const getTimePresets = (selectedDate?: Date): TimePreset[] => {
  const presets: TimePreset[] = []
  
  // Add "Tomorrow morning" if the selected date is tomorrow
  if (selectedDate) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    
    const selectedDay = new Date(selectedDate)
    selectedDay.setHours(0, 0, 0, 0)
    
    if (selectedDay.getTime() === tomorrow.getTime()) {
      presets.push({ label: "Tomorrow morning", hour: 14, minute: 0, description: "9 AM ET" })
    }
  }
  
  // Add regular presets
  presets.push(
    { label: "US Morning", hour: 14, minute: 0, description: "9 AM ET" },
    { label: "US Afternoon", hour: 18, minute: 0, description: "1 PM ET" },
    { label: "US Evening", hour: 23, minute: 0, description: "6 PM ET" },
    { label: "EU Morning", hour: 8, minute: 0, description: "9 AM CET" },
    { label: "Asia Evening", hour: 9, minute: 0, description: "6 PM JST" },
  )
  
  return presets
}

export function EnhancedDateTimePicker({
  jsDate,
  onJsDateChange,
  showClearButton = true,
  granularity = "minute",
  hourCycle = 24,
  disabled = false,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(jsDate || undefined)
  const [timeValue, setTimeValue] = React.useState<string>(() => {
    if (jsDate) {
      const hours = jsDate.getHours().toString().padStart(2, '0')
      const minutes = jsDate.getMinutes().toString().padStart(2, '0')
      return `${hours}:${minutes}`
    }
    return "16:00" // Default to 16:00 UTC (US morning)
  })

  // Update internal state when jsDate prop changes
  React.useEffect(() => {
    if (jsDate) {
      setSelectedDate(jsDate)
      const hours = jsDate.getHours().toString().padStart(2, '0')
      const minutes = jsDate.getMinutes().toString().padStart(2, '0')
      setTimeValue(`${hours}:${minutes}`)
    } else {
      setSelectedDate(undefined)
      setTimeValue("16:00")
    }
  }, [jsDate])

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return
    
    setSelectedDate(date)
    updateDateTime(date, timeValue)
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setTimeValue(value)
    
    if (selectedDate && value) {
      const [hours, minutes] = value.split(':').map(Number)
      const testDate = new Date(selectedDate)
      testDate.setHours(hours, minutes, 0, 0)
      
      // If the selected date is today, validate the time isn't in the past
      if (isToday(selectedDate) && isBefore(testDate, new Date())) {
        // Don't update if it would be in the past
        return
      }
      
      updateDateTime(selectedDate, value)
    }
  }

  const handleTimePreset = (preset: TimePreset) => {
    const timeStr = `${preset.hour.toString().padStart(2, '0')}:${preset.minute.toString().padStart(2, '0')}`
    setTimeValue(timeStr)
    
    if (selectedDate) {
      const testDate = new Date(selectedDate)
      testDate.setHours(preset.hour, preset.minute, 0, 0)
      
      // If the selected date is today, validate the time isn't in the past
      if (isToday(selectedDate) && isBefore(testDate, new Date())) {
        // Don't update if it would be in the past
        return
      }
      
      updateDateTime(selectedDate, timeStr)
    }
  }

  const updateDateTime = (date: Date, timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number)
    const newDate = new Date(date)
    newDate.setHours(hours, minutes, 0, 0)
    
    // Don't round here - let the parent component handle it
    onJsDateChange?.(newDate)
  }

  const handleClear = () => {
    setSelectedDate(undefined)
    setTimeValue("16:00")
    onJsDateChange?.(null)
    setOpen(false)
  }

  const formatDisplayText = () => {
    if (!jsDate) return "Select date & time"
    
    try {
      return format(jsDate, "MMM d, yyyy 'at' HH:mm")
    } catch {
      return "Select date & time"
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal min-w-[180px] sm:min-w-[200px] h-9 text-sm",
              !jsDate && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDisplayText()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-screen sm:w-auto p-0 max-w-[95vw] sm:max-w-none" align="start">
          <div className="flex flex-col sm:flex-row">
            {/* Calendar Section */}
            <div className="p-3 sm:border-r border-b sm:border-b-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={{
                  before: startOfToday()
                }}
                initialFocus
              />
            </div>
            
            {/* Time Section */}
            <div className="p-3 space-y-4 w-full sm:w-[280px]">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Time (24h)</Label>
                  {selectedDate && timeValue && (
                    <span className="text-xs text-muted-foreground">
                      {(() => {
                        const [hours, minutes] = timeValue.split(':').map(Number)
                        const testDate = new Date(selectedDate)
                        testDate.setHours(hours, minutes, 0, 0)
                        const utcHours = testDate.getUTCHours().toString().padStart(2, '0')
                        const utcMinutes = testDate.getUTCMinutes().toString().padStart(2, '0')
                        return `${utcHours}:${utcMinutes} UTC`
                      })()}
                    </span>
                  )}
                </div>
                <Input
                  type="time"
                  value={timeValue}
                  onChange={handleTimeChange}
                  step="300" // 5 minute steps
                  className="w-full"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium mb-2 block">Quick presets</Label>
                <div className="space-y-1">
                  {getTimePresets(selectedDate).map((preset) => (
                    <Button
                      key={preset.label}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between text-xs"
                      onClick={() => handleTimePreset(preset)}
                    >
                      <span>{preset.label}</span>
                      <span className="text-muted-foreground">{preset.description}</span>
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="pt-2 border-t sm:hidden">
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      {showClearButton && jsDate && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleClear}
          disabled={disabled}
        >
          <XMarkIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}