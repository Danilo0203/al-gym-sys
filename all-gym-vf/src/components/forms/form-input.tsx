'use client';

import { FieldPath, FieldValues } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { BaseFormFieldProps } from '@/types/base-form';

interface FormInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends BaseFormFieldProps<TFieldValues, TName> {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  placeholder?: string;
  step?: string | number;
  min?: string | number;
  max?: string | number;
}

function FormInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  description,
  required,
  type = 'text',
  placeholder,
  step,
  min,
  max,
  disabled,
  className
}: FormInputProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          {label && (
            <FieldLabel htmlFor={String(field.name)}>
              {label}
              {required && <span className='ml-1 text-red-500'>*</span>}
            </FieldLabel>
          )}
          <Input
            id={String(field.name)}
            type={type}
            placeholder={placeholder}
            step={step}
            min={min}
            max={max}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
            {...field}
            value={
              type === 'number'
                ? field.value === 0 || field.value === undefined || field.value === null
                  ? ''
                  : field.value
                : field.value ?? ''
            }
            onChange={(e) => {
              if (type === 'number') {
                const value = e.target.value;
                field.onChange(value === '' ? undefined : parseFloat(value));
              } else {
                field.onChange(e.target.value);
              }
            }}
          />
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export { FormInput };
