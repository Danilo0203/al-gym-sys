'use client';

import { Controller, FieldPath, FieldValues } from 'react-hook-form';
import { Slider } from '@/components/ui/slider';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { BaseFormFieldProps, SliderConfig } from '@/types/base-form';

interface FormSliderProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends BaseFormFieldProps<TFieldValues, TName> {
  config: SliderConfig;
  showValue?: boolean;
}

function FormSlider<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({ control, name, label, description, required, config, showValue = true, disabled, className }: FormSliderProps<TFieldValues, TName>) {
  const { min, max, step = 1, formatValue } = config;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          {label && (
            <FieldLabel>
              {label}
              {required && <span className='ml-1 text-red-500'>*</span>}
            </FieldLabel>
          )}
          <div className='px-3'>
            <Slider
              min={min}
              max={max}
              step={step}
              value={[field.value || min]}
              onValueChange={(value) => field.onChange(value[0])}
              disabled={disabled}
              aria-invalid={fieldState.invalid}
            />
            {showValue && (
              <div className='text-muted-foreground mt-1 flex justify-between text-sm'>
                <span>{formatValue ? formatValue(min) : min}</span>
                <span>{formatValue ? formatValue(field.value || min) : field.value || min}</span>
                <span>{formatValue ? formatValue(max) : max}</span>
              </div>
            )}
          </div>
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export { FormSlider };
