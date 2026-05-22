"use client";

import { useState } from "react";
import { isValid } from "date-fns";
import { es } from "date-fns/locale";
import { IconCalendar } from "@tabler/icons-react";
import { Calendar } from "@/components/ui/calendar";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateInputValue, parseFlexibleDateInput } from "@/lib/date-input";

interface FlexibleDatePickerInputProps {
  value?: Date;
  onChange: (date?: Date) => void;
  endMonth?: Date;
  placeholder?: string;
  maxLength?: number;
}

export function FlexibleDatePickerInput({
  value,
  onChange,
  endMonth,
  placeholder = "DD/MM/YYYY",
  maxLength = 10,
}: FlexibleDatePickerInputProps) {
  const [inputValue, setInputValue] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(value && isValid(value) ? value : new Date());
  const displayedValue = inputValue ?? formatDateInputValue(value && isValid(value) ? value : undefined);

  const syncDate = (rawValue: string) => {
    const normalizedValue = rawValue.trim();
    if (!normalizedValue) {
      onChange(undefined);
      return false;
    }

    const parsedDate = parseFlexibleDateInput(normalizedValue);
    if (!parsedDate) return false;

    setVisibleMonth(parsedDate);
    onChange(parsedDate);
    return true;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value;
    setInputValue(nextValue);

    if (!nextValue.trim()) {
      onChange(undefined);
      return;
    }

    syncDate(nextValue);
  };

  const handleInputBlur = () => {
    if (!inputValue) {
      setInputValue(undefined);
      return;
    }

    syncDate(inputValue);
    setInputValue(undefined);
  };

  return (
    <InputGroup>
      <InputGroupInput
        value={displayedValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        maxLength={maxLength}
      />
      <InputGroupAddon align="inline-end">
        <Popover
          modal={false}
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (nextOpen) {
              setVisibleMonth(value && isValid(value) ? value : new Date());
            }
          }}
        >
          <PopoverTrigger asChild>
            <InputGroupButton variant="ghost" size="icon-sm" className="shrink-0" tabIndex={-1}>
              <IconCalendar className="h-4 w-4 opacity-50" />
            </InputGroupButton>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={value}
              month={visibleMonth}
              onMonthChange={setVisibleMonth}
              onSelect={(date) => {
                onChange(date);
                if (date && isValid(date)) {
                  setVisibleMonth(date);
                }
                setInputValue(undefined);
              }}
              autoFocus
              locale={es}
              captionLayout="dropdown"
              startMonth={new Date(1920, 0)}
              endMonth={endMonth}
            />
          </PopoverContent>
        </Popover>
      </InputGroupAddon>
    </InputGroup>
  );
}
