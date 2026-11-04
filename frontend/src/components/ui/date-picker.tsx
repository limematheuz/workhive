"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { es } from "date-fns/locale"
import type { Matcher } from "react-day-picker"

import {
  formatDateTyping,
  formatSpanishDate,
  isDateWithinBounds,
  parseIsoDate,
  parseTypedDate,
  toIsoDate,
} from "@/lib/date-picker-utils"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type DatePickerProps = Omit<React.ComponentProps<typeof InputGroupInput>, "value" | "onChange" | "min" | "max"> & {
  value: string
  onValueChange: (value: string) => void
  min?: string
  max?: string
}

function DatePicker({
  value,
  onValueChange,
  min,
  max,
  className,
  onKeyDown,
  onBlur,
  disabled = false,
  ...props
}: DatePickerProps) {
  const date = parseIsoDate(value)
  const [open, setOpen] = React.useState(false)
  const [month, setMonth] = React.useState<Date | undefined>(date)
  const [inputState, setInputState] = React.useState(() => ({
    value,
    text: formatSpanishDate(date),
  }))
  const inputValue = inputState.value === value ? inputState.text : formatSpanishDate(date)
  const disabledDates = React.useMemo<Matcher | undefined>(() => {
    const before = parseIsoDate(min)
    const after = parseIsoDate(max)
    if (before && after) return { before, after }
    if (before) return { before }
    if (after) return { after }
    return undefined
  }, [max, min])

  if (disabled && open) setOpen(false)

  const selectDate = React.useCallback((nextDate: Date | undefined) => {
    if (disabled || !nextDate) return
    const nextValue = toIsoDate(nextDate)
    onValueChange(nextValue)
    setInputState({ value: nextValue, text: formatSpanishDate(nextDate) })
    setMonth(nextDate)
    setOpen(false)
  }, [disabled, onValueChange])

  return (
    <div className="style-vega w-full">
      <InputGroup className={cn("h-11 border-[var(--border-color)] bg-[var(--bg-primary)] shadow-none", className)}>
        <InputGroupInput
          {...props}
          disabled={disabled}
          className="dialog-compact-control !border-0 !bg-transparent !shadow-none focus:!border-0 focus:!shadow-none"
          value={inputValue}
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          autoComplete="off"
          onChange={(event) => {
            const nextValue = formatDateTyping(event.target.value)
            const nextDate = parseTypedDate(nextValue)
            if (!nextValue) {
              onValueChange("")
              setInputState({ value: "", text: "" })
              return
            }
            setInputState({ value, text: nextValue })
            if (nextDate && isDateWithinBounds(nextDate, min, max)) {
              onValueChange(toIsoDate(nextDate))
              setMonth(nextDate)
            }
          }}
          onBlur={(event) => {
            const nextDate = parseTypedDate(event.currentTarget.value)
            setInputState({
              value,
              text: nextDate && isDateWithinBounds(nextDate, min, max)
                ? formatSpanishDate(nextDate)
                : formatSpanishDate(date),
            })
            onBlur?.(event)
          }}
          onKeyDown={(event) => {
            if (!disabled && event.key === "ArrowDown") {
              event.preventDefault()
              setOpen(true)
            }
            onKeyDown?.(event)
          }}
        />
        <InputGroupAddon align="inline-end">
          <Popover open={open && !disabled} onOpenChange={(nextOpen) => setOpen(nextOpen && !disabled)}>
            <PopoverTrigger asChild>
              <InputGroupButton
                id={`${props.id}-calendar`}
                variant="ghost"
                size="icon-xs"
                aria-label="Abrir calendario"
                disabled={disabled}
              >
                <CalendarIcon />
                <span className="sr-only">Abrir calendario</span>
              </InputGroupButton>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto overflow-hidden p-0"
              align="end"
              alignOffset={-8}
              sideOffset={10}
            >
              <div className="style-vega">
                <Calendar
                  mode="single"
                  selected={date}
                  month={month}
                  onMonthChange={setMonth}
                  onSelect={selectDate}
                  disabled={disabledDates}
                  locale={es}
                  weekStartsOn={1}
                />
              </div>
            </PopoverContent>
          </Popover>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

export { DatePicker }
