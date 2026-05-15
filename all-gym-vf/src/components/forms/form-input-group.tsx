'use client';

import { Controller, FieldPath, FieldValues } from 'react-hook-form';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { BaseFormFieldProps } from '@/types/base-form';

interface FormInputGroupProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends BaseFormFieldProps<TFieldValues, TName> {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  placeholder?: string;
  step?: string | number;
  min?: string | number;
  max?: string | number;
  maxLength?: number;
  pattern?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end';
  addonText?: string;
  addonTextPosition?: 'start' | 'end';
}

function FormInputGroup<
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
  maxLength,
  pattern,
  inputMode,
  disabled,
  className,
  icon,
  iconPosition = 'start',
  addonText,
  addonTextPosition = 'start'
}: FormInputGroupProps<TFieldValues, TName>) {
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
          <InputGroup data-disabled={disabled}>
            {icon && iconPosition === 'start' && <InputGroupAddon align='inline-start'>{icon}</InputGroupAddon>}
            {addonText && addonTextPosition === 'start' && (
              <InputGroupAddon align='inline-start'>
                <InputGroupText>{addonText}</InputGroupText>
              </InputGroupAddon>
            )}
            <InputGroupInput
              id={String(field.name)}
              type={type}
              placeholder={placeholder}
              step={step}
              min={min}
              max={max}
              maxLength={maxLength}
              pattern={pattern}
              inputMode={inputMode}
              disabled={disabled}
              aria-invalid={fieldState.invalid}
              {...field}
              value={
                type === 'number'
                  ? field.value === 0 || field.value === undefined || field.value === null || (typeof field.value === 'number' && isNaN(field.value))
                    ? ''
                    : field.value
                  : field.value ?? ''
              }
              onChange={(e) => {
                if (type === 'number') {
                  const value = e.target.value;
                  field.onChange(value === '' ? undefined : Number.parseFloat(value));
                } else if (type === 'tel') {
                  const numericOnly = e.target.value.replace(/\D/g, '');
                  field.onChange(maxLength ? numericOnly.slice(0, maxLength) : numericOnly);
                } else {
                  field.onChange(e.target.value);
                }
              }}
            />
            {icon && iconPosition === 'end' && <InputGroupAddon align='inline-end'>{icon}</InputGroupAddon>}
            {addonText && addonTextPosition === 'end' && (
              <InputGroupAddon align='inline-end'>
                <InputGroupText>{addonText}</InputGroupText>
              </InputGroupAddon>
            )}
          </InputGroup>
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export { FormInputGroup };
