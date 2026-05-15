'use client';

import { Controller, FieldPath, FieldValues } from 'react-hook-form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Field, FieldDescription, FieldError, FieldLabel, FieldSet, FieldLegend } from '@/components/ui/field';
import { BaseFormFieldProps, RadioGroupOption } from '@/types/base-form';

interface FormRadioGroupProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends BaseFormFieldProps<TFieldValues, TName> {
  options: RadioGroupOption[];
  orientation?: 'horizontal' | 'vertical';
}

function FormRadioGroup<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({ control, name, label, description, required, options, orientation = 'vertical', disabled, className }: FormRadioGroupProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldSet className={className}>
          {label && (
            <FieldLegend>
              {label}
              {required && <span className='ml-1 text-red-500'>*</span>}
            </FieldLegend>
          )}
          {description && <FieldDescription>{description}</FieldDescription>}
          <RadioGroup
            onValueChange={field.onChange}
            value={field.value}
            disabled={disabled}
            className={orientation === 'horizontal' ? 'flex flex-row space-x-6' : 'space-y-2'}
          >
            {options.map((option) => (
              <Field key={option.value} orientation='horizontal' data-invalid={fieldState.invalid}>
                <RadioGroupItem value={option.value} id={`${name}-${option.value}`} disabled={option.disabled} aria-invalid={fieldState.invalid} />
                <Label htmlFor={`${name}-${option.value}`} className='text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                  {option.label}
                </Label>
              </Field>
            ))}
          </RadioGroup>
          <FieldError errors={[fieldState.error]} />
        </FieldSet>
      )}
    />
  );
}

export { FormRadioGroup, type RadioGroupOption };
