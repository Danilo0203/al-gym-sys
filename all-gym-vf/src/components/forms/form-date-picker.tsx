'use client';

import { FieldPath, FieldValues } from 'react-hook-form';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { BaseFormFieldProps, DatePickerConfig } from '@/types/base-form';

interface FormDatePickerProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends BaseFormFieldProps<TFieldValues, TName> {
  config?: DatePickerConfig;
}

function FormDatePicker<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  description,
  required,
  config = {},
  disabled,
  className
}: FormDatePickerProps<TFieldValues, TName>) {
  const {
    minDate,
    maxDate,
    disabledDates = [],
    placeholder = 'Pick a date'
  } = config;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={`flex flex-col ${className}`}>
          {label && (
            <FieldLabel>
              {label}
              {required && <span className='ml-1 text-red-500'>*</span>}
            </FieldLabel>
          )}
          <Popover modal={false}>
            <PopoverTrigger asChild>
              <Button
                variant='outline'
                className={`w-full pl-3 text-left font-normal ${!field.value && 'text-muted-foreground'}`}
                disabled={disabled}
                aria-invalid={fieldState.invalid}
              >
                {field.value ? format(field.value, 'PPP') : <span>{placeholder}</span>}
                <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0' align='start'>
              <Calendar
                mode='single'
                selected={field.value}
                onSelect={field.onChange}
                disabled={(date) => {
                  if (minDate && date < minDate) return true;
                  if (maxDate && date > maxDate) return true;
                  return disabledDates.some(
                    (disabledDate) => date.getTime() === disabledDate.getTime()
                  );
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export { FormDatePicker };
