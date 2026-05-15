'use client';

import { FieldPath, FieldValues } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { BaseFormFieldProps } from '@/types/base-form';

interface FormSwitchProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends BaseFormFieldProps<TFieldValues, TName> {
  showDescription?: boolean;
}

function FormSwitch<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  description,
  required,
  showDescription = true,
  disabled,
  className
}: FormSwitchProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field orientation='horizontal' data-invalid={fieldState.invalid} className={`rounded-lg border p-4 ${className}`}>
          <FieldContent>
            <FieldLabel className='text-base'>
              {label}
              {required && <span className='ml-1 text-red-500'>*</span>}
            </FieldLabel>
            {showDescription && description && <FieldDescription>{description}</FieldDescription>}
            <FieldError errors={[fieldState.error]} />
          </FieldContent>
          <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} aria-invalid={fieldState.invalid} />
        </Field>
      )}
    />
  );
}

export { FormSwitch };
