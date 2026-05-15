import * as z from 'zod';

export const profileSchema = z.object({
  firstname: z
    .string()
    .min(3, { message: 'Debe tener al menos 3 caracteres' }),
  lastname: z
    .string()
    .min(3, { message: 'Debe tener al menos 3 caracteres' }),
  email: z
    .string()
    .email({ message: 'Debes ingresar un correo electrónico válido' }),
  contactno: z.coerce.number(),
  country: z.string().min(1, { message: 'Selecciona una categoría' }),
  city: z.string().min(1, { message: 'Selecciona una categoría' }),
  // jobs array is for the dynamic fields
  jobs: z.array(
    z.object({
      jobcountry: z.string().min(1, { message: 'Selecciona una categoría' }),
      jobcity: z.string().min(1, { message: 'Selecciona una categoría' }),
      jobtitle: z
        .string()
        .min(3, { message: 'Debe tener al menos 3 caracteres' }),
      employer: z
        .string()
        .min(3, { message: 'Debe tener al menos 3 caracteres' }),
      startdate: z
        .string()
        .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
          message: 'La fecha de inicio debe tener el formato AAAA-MM-DD'
        }),
      enddate: z.string().refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
        message: 'La fecha de fin debe tener el formato AAAA-MM-DD'
      })
    })
  )
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
