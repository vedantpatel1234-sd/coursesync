export type UserRole = 'admin' | 'instructor'
export type AssignmentStatus = 'pending' | 'confirmed' | 'rejected'
export type SectionStatus = 'unassigned' | 'partial' | 'filled'
export type DraftStatus = 'sandbox' | 'published'
export type ConflictType = 'over_hours' | 'not_qualified' | 'already_assigned'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  created_at: string
}

export interface InstructorProfile {
  id: string
  user_id: string
  max_hours_per_term: number
  department?: string
  title?: string
  created_at: string
}

export interface Term {
  id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
}

export interface Course {
  id: string
  code: string
  name: string
  description?: string
  created_at: string
}

export interface Section {
  id: string
  course_id: string
  term_id: string
  section_number: string
  hours_required: number
  status: SectionStatus
  notes?: string
  created_at: string
  course?: Course
  term?: Term
}

export interface Qualification {
  id: string
  instructor_id: string
  course_id: string
  verified: boolean
  added_by?: string
  created_at: string
  course?: Course
  instructor?: Profile
}

export interface Preference {
  id: string
  instructor_id: string
  section_id: string
  rank: number
  note?: string
  created_at: string
  updated_at: string
  section?: Section
}

export interface Assignment {
  id: string
  instructor_id: string
  section_id: string
  hours_assigned: number
  status: AssignmentStatus
  assigned_by?: string
  draft_id?: string
  created_at: string
  updated_at: string
  instructor?: Profile
  section?: Section
}

export interface Draft {
  id: string
  term_id: string
  name: string
  created_by: string
  status: DraftStatus
  is_ai_generated: boolean
  created_at: string
  published_at?: string
}

export interface ConflictLog {
  id: string
  draft_id?: string
  instructor_id?: string
  section_id?: string
  reason: string
  conflict_type: ConflictType
  created_at: string
  instructor?: Profile
  section?: Section
}

export interface InstructorWorkload {
  instructor_id: string
  full_name: string
  max_hours_per_term: number
  term_id: string
  term_name: string
  hours_assigned: number
  hours_remaining: number
}