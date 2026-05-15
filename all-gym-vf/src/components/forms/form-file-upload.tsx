'use client';

import { FieldPath, FieldValues } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { BaseFormFieldProps, FileUploadConfig } from '@/types/base-form';
import { FileUploader } from '@/components/file-uploader';

interface FormFileUploadProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends BaseFormFieldProps<TFieldValues, TName> {
  config?: FileUploadConfig;
}

function FormFileUpload<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  description,
  required,
  config,
  disabled,
  className
}: FormFileUploadProps<TFieldValues, TName>) {
  const {
    maxSize,
    acceptedTypes,
    multiple,
    maxFiles,
    onUpload,
    progresses,
    ...restConfig
  } = config || {};

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

          <FileUploader
            value={field.value}
            onValueChange={field.onChange}
            onUpload={onUpload}
            progresses={progresses}
            accept={acceptedTypes?.reduce((acc, type) => ({ ...acc, [type]: [] }), {})}
            maxSize={maxSize}
            maxFiles={maxFiles}
            multiple={multiple}
            disabled={disabled}
            {...restConfig}
          />

          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export { FormFileUpload, type FileUploadConfig };
