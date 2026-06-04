import { z } from 'zod'

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[!@#$%^&*]/, 'Must contain at least one special character (!@#$%^&*)')

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const courseSchema = z.object({
  code: z
    .string()
    .min(1, 'Course code is required')
    .max(10, 'Course code must be 10 characters or less')
    .refine(val => /^[A-Za-z0-9]+$/.test(val), 'Course code must be letters and numbers only'),
  name: z
    .string()
    .min(3, 'Course name must be at least 3 characters')
    .max(100, 'Course name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
})

export const sectionSchema = z.object({
  course_id: z.string().min(1, 'Course is required'),
  term_id: z.string().min(1, 'Term is required'),
  section_number: z
    .string()
    .min(1, 'Section number is required')
    .max(5, 'Section number must be 5 characters or less'),
  hours_required: z
    .number()
    .min(1, 'Hours must be at least 1')
    .max(20, 'Hours must be 20 or less'),
  notes: z.string().max(500).optional(),
})

export const instructorSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be 100 characters or less'),
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  department: z.string().max(100).optional(),
  title: z.string().max(100).optional(),
  max_hours: z
    .number()
    .min(1, 'Max hours must be at least 1')
    .max(100, 'Max hours must be 100 or less'),
})

export const draftSchema = z.object({
  name: z
    .string()
    .min(2, 'Draft name must be at least 2 characters')
    .max(100, 'Draft name must be 100 characters or less'),
  term_id: z.string().min(1, 'Term is required'),
})

export type LoginForm = z.infer<typeof loginSchema>
export type CourseForm = z.infer<typeof courseSchema>
export type SectionForm = z.infer<typeof sectionSchema>
export type InstructorForm = z.infer<typeof instructorSchema>
export type DraftForm = z.infer<typeof draftSchema>