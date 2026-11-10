export type Role = 'admin' | 'trabajador';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  active: boolean;
  created_by: string | null;
  farm_id: string | null;
  farm_name?: string | null;
  photo_url?: string | null;
  created_at: string;
}

export interface Farm {
  id: string;
  name: string;
  logo_url: string | null;
}

export interface Animal {
  id: string;
  ica_code: string;
  name: string;
  species: 'bovino' | 'equino' | 'porcino' | 'caprino' | 'ovino' | 'otro'
    | 'vaca' | 'toro' | 'ternero' | 'caballo' | 'cerdo' | 'chivo' | 'oveja';
  category: string;
  breed: string;
  sex: 'macho' | 'hembra';
  birth_date: string | null;
  weight_kg: number | null;
  health_status: 'sano' | 'enfermo' | 'en_tratamiento' | 'fallecido';
  photo_url: string | null;
  notes: string | null;
  active: boolean;
  lactation_status: 'llenando' | 'parida' | null;
  ref_number: number | null;
  created_at: string;
  updated_at: string;
  __offlineQueued?: boolean;
  __offlineStatus?: 'queued' | 'conflict' | 'rejected';
}

export interface MilkProduction {
  id: string;
  animal_id: string;
  date: string;
  morning_liters: number;
  afternoon_liters: number;
  total_liters: number;
  registered_by: string | null;
  notes: string | null;
  created_at: string;
  animal?: Pick<Animal, 'id' | 'name' | 'ica_code' | 'species' | 'sex' | 'notes' | 'breed' | 'category'>;
}

export interface Vaccine {
  id: string;
  animal_id: string | null;
  vaccine_name: string;
  scheduled_date: string;
  applied_date: string | null;
  medication: string | null;
  medication_id: string | null;
  dose: string | null;
  applied_by: string | null;
  status: 'pendiente' | 'aplicada' | 'vencida';
  notes: string | null;
  created_at: string;
  animal?: Pick<Animal, 'id' | 'name' | 'ica_code' | 'species' | 'sex' | 'notes' | 'breed' | 'category'>;
}

export interface Medication {
  id: string;
  name: string;
  type: 'antibiotico' | 'vitamina' | 'desparasitante' | 'antiparasitario' | 'otro';
  quantity: number;
  unit: string;
  dose: string | null;
  expiry_date: string | null;
  supplier: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Input {
  id: string;
  name: string;
  type: 'fertilizante' | 'herbicida' | 'insecticida' | 'veneno' | 'semilla' | 'otro';
  quantity: number;
  unit: string;
  supplier: string | null;
  purchase_date: string | null;
  price: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Equipment {
  id: string;
  name: string;
  type: 'motosierra' | 'guadana' | 'bomba_fumigadora' | 'tractor' | 'herramienta_manual' | 'otro';
  status: 'bueno' | 'regular' | 'malo' | 'en_reparacion';
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Crop {
  id: string;
  name: string;
  type: 'maiz' | 'yuca' | 'frijol' | 'pasto' | 'otro';
  area_hectares: number | null;
  planting_date: string | null;
  expected_harvest_date: string | null;
  harvest_date: string | null;
  fertilization_notes: string | null;
  production_kg: number | null;
  status: 'activo' | 'cosechado' | 'perdido';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FishPond {
  id: string;
  pond_name: string;
  species: string;
  quantity: number;
  avg_weight_kg: number | null;
  feeding_notes: string | null;
  mortality: number;
  production_kg: number | null;
  status: 'activo' | 'cosechado' | 'inactivo';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyActivity {
  id: string;
  worker_id: string | null;
  date: string;
  activity_type: 'ordeno' | 'alimentacion' | 'nacimiento' | 'consulta_animal' | 'reporte_enfermedad' | 'otro';
  description: string;
  animal_id: string | null;
  notes: string | null;
  created_at: string;
  animal?: Pick<Animal, 'id' | 'name' | 'ica_code' | 'species' | 'sex' | 'notes' | 'breed' | 'category'>;
  worker?: Pick<Profile, 'id' | 'full_name'>;
  __offlineQueued?: boolean;
}

export interface ActivitySubmission {
  id: string;
  worker: Pick<Profile, 'id' | 'full_name'>;
  action: 'created' | 'updated' | 'deleted';
  data: Pick<DailyActivity, 'date' | 'activity_type' | 'description' | 'notes' | 'animal_id'> & {
    animal?: Pick<Animal, 'id' | 'name' | 'ica_code' | 'species' | 'sex' | 'notes' | 'breed' | 'category'> | null;
  };
  created_at: string;
}

export interface DiseaseReport {
  id: string;
  animal_id: string;
  reported_by: string | null;
  report_date: string;
  symptoms: string;
  diagnosis: string | null;
  treatment: string | null;
  status: 'abierto' | 'en_tratamiento' | 'resuelto';
  notes: string | null;
  created_at: string;
  updated_at: string;
  animal?: Pick<Animal, 'id' | 'name' | 'ica_code' | 'species' | 'sex' | 'notes' | 'breed' | 'category'>;
}

export interface FarmSettings {
  id: string;
  farm_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_mode: 'light' | 'dark';
  sidebar_style: 'dark' | 'light';
  header_style: 'dark' | 'light' | 'transparent';
  show_footer: boolean;
  footer_text: string;
  updated_at: string;
  updated_by: string | null;
}

export interface ModuleTheme {
  id: string;
  module_key: string;
  card_radius: string;
  card_padding: string;
  card_border_color: string;
  card_bg_color: string;
  card_shadow: string;
  grid_columns: string;
  grid_gap: string;
  heading_size: string;
  heading_color: string;
  body_text_size: string;
  body_text_color: string;
  accent_color: string;
  table_header_bg: string;
  table_row_hover_bg: string;
  density: 'compact' | 'normal' | 'comfortable';
  updated_at: string;
  updated_by: string | null;
}
