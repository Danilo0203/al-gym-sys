'use client';

import { Controller, FieldPath, FieldValues } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { FieldError, FieldGroup, FieldLabel, FieldSet, FieldLegend, FieldDescription, Field } from '@/components/ui/field';
import { BaseFormFieldProps, CheckboxGroupOption } from '@/types/base-form';

interface FormCheckboxGroupProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends BaseFormFieldProps<TFieldValues, TName> {
  options: CheckboxGroupOption[];
  showBadges?: boolean;
  columns?: 1 | 2 | 3 | 4;
}

function FormCheckboxGroup<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({ control, name, label, description, required, options, showBadges = true, columns = 2, disabled, className }: FormCheckboxGroupProps<TFieldValues, TName>) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
  };

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldSet className={className}>
          {label && (
            <FieldLegend variant='label'>
              {label}
              {required && <span className='ml-1 text-red-500'>*</span>}
            </FieldLegend>
          )}
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldGroup data-slot='checkbox-group' className={`grid gap-4 ${gridCols[columns]}`}>
            {options.map((option) => (
              <Field key={option.value} orientation='horizontal' data-invalid={fieldState.invalid}>
                <Checkbox
                  id={`${name}-${option.value}`}
                  checked={field.value?.includes(option.value) || false}
                  onCheckedChange={(checked) => {
                    const currentValues = field.value || [];
                    if (checked) {
                      field.onChange([...currentValues, option.value]);
                    } else {
                      field.onChange(currentValues.filter((value: string) => value !== option.value));
                    }
                  }}
                  disabled={disabled || option.disabled}
                  aria-invalid={fieldState.invalid}
                />
                <FieldLabel htmlFor={`${name}-${option.value}`} className='font-normal'>
                  {option.label}
                </FieldLabel>
              </Field>
            ))}
          </FieldGroup>
          {showBadges && field.value && field.value.length > 0 && (
            <div className='mt-2 flex flex-wrap gap-2'>
              {field.value.map((value: string) => {
                const option = options.find((opt) => opt.value === value);
                return (
                  <Badge key={value} variant='secondary'>
                    {option?.label || value}
                  </Badge>
                );
              })}
            </div>
          )}
          <FieldError errors={[fieldState.error]} />
        </FieldSet>
      )}
    />
  );
}

export { FormCheckboxGroup, type CheckboxGroupOption };
