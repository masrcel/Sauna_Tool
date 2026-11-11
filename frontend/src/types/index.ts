export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  avatar_url?: string;
  active: boolean;
}

export interface Sauna {
  id: string;
  name: string;
  description?: string;
  sort_order: number;
  active: boolean;
  break_minutes: number;
}

export interface Scent {
  id: string;
  name: string;
  description?: string;
  category?: string;
  color?: string;
  default_dosage_ml?: number | null;
  dosage_unit: string;
  dosage_note?: string | null;
}

export interface TemplateScent {
  id: string;
  scent_id: string;
  scent_name: string;
  dosage_ml?: number;
  dosage_note?: string;
  sort_order: number;
  color?: string;
}

export interface AufgussTemplate {
  id: string;
  name: string;
  subtitle?: string;
  description?: string;
  duration_minutes: number;
  created_by?: string;
  creator_name?: string;
  scents: TemplateScent[];
}

export interface ScheduleEntry {
  id: string;
  sauna_id: string;
  sauna_name: string;
  template_id?: string;
  template_name?: string;
  template_subtitle?: string;
  duration_minutes?: number;
  assigned_user_id?: string;
  staff_name?: string;
  staff_avatar?: string;
  custom_name?: string;
  custom_subtitle?: string;
  start_time: string;
  end_time?: string;
  status: 'geplant' | 'läuft' | 'fertig' | 'abgesagt';
  sort_order: number;
  scents: { scent_id?: string; scent_name: string; dosage_ml?: number; dosage_note?: string; color?: string }[];
}

export interface DayEvent {
  id: string;
  event_date: string;
  title?: string;
  notes?: string;
  schedule: ScheduleEntry[];
}

export interface IdeaComment {
  id: string;
  content: string;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
}

export interface Idea {
  id: string;
  title: string;
  category: 'duft' | 'zeremonie' | 'musik' | 'sonstiges';
  content: string;
  tags: string[];
  created_by?: string;
  creator_name?: string;
  creator_avatar?: string;
  created_at: string;
  updated_at: string;
  comments: IdeaComment[];
  comment_count: number;
}
