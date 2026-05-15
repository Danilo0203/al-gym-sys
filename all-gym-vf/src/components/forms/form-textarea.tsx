'use client';

import { FieldPath, FieldValues } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { BaseFormFieldProps, TextareaConfig } from '@/types/base-form';

interface FormTextareaProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends BaseFormFieldProps<TFieldValues, TName> {
  placeholder?: string;
  config?: TextareaConfig;
}

function FormTextarea<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  description,
  required,
  placeholder,
  config = {},
  disabled,
  className
}: FormTextareaProps<TFieldValues, TName>) {
  const {
    maxLength,
    showCharCount = true,
    rows = 4,
    resize = 'vertical'
  } = config;

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
          <Textarea
            id={String(field.name)}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            style={{ resize }}
            maxLength={maxLength}
            aria-invalid={fieldState.invalid}
            {...field}
          />
          {showCharCount && maxLength && (
            <div className='text-muted-foreground text-right text-sm'>
              {field.value?.length || 0} / {maxLength}
            </div>
          )}
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export { FormTextarea };
