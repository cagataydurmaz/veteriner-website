export type UserRole = 'owner' | 'vet' | 'admin';

export interface User {
  id: string;
  phone: string | null;
  email: string | null;
  role: UserRole;
  full_name: string;
  city: string | null;
  created_at: string;
}

export interface Pet {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  breed: string | null;
  birth_date: string | null;
  weight: number | null;
  photo_url: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  created_at?: string;
}

export interface Veterinarian {
  id: string;
  user_id: string;
  license_number: string | null;
  specialty: string;
  city: string;
  district: string | null;
  bio: string | null;
  subscription_tier: 'free' | 'basic' | 'pro' | 'premium';
  is_verified: boolean;
  is_demo?: boolean;
  license_document_url: string | null;
  consultation_fee: number;
  video_consultation_fee: number;
  nobetci_fee?: number;
  // Service type flags
  offers_in_person: boolean;
  offers_video: boolean;
  offers_nobetci: boolean;
  // Real-time status toggles
  is_online_now?: boolean;
  is_on_call?: boolean;
  is_available_today?: boolean;
  // Profile fields
  full_name?: string;       // Denormalized on veterinarians for demo vets
  photo_url?: string | null;
  chamber_number?: string | null;
  sicil_no?: string | null;
  average_rating: number;
  total_reviews: number;
  // Account management
  account_status?: string | null;
  suspended_until?: string | null;
  suspension_reason?: string | null;
  rejection_reason?: string | null;
  admin_note?: string | null;
  last_active_at?: string | null;
  created_at?: string;
  user?: User;
}

export interface AvailabilitySlot {
  id: string;
  vet_id: string;
  day_of_week: number; // 0=Sunday, 1=Monday, ...
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export type AppointmentType = 'in_person' | 'video';
export type AppointmentCanonicalType = 'clinic' | 'online';
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed' | null;
export type EscrowStatus = 'held' | 'released' | 'refunded' | null;
export type CancelledBy = 'owner' | 'vet' | 'system' | null;

export interface Appointment {
  id: string;
  pet_id: string;
  vet_id: string;
  owner_id: string;
  datetime: string;
  /** Legacy type column — prefer appointment_type for new code */
  type: AppointmentType;
  /** Canonical type column used by booking API and search filters */
  appointment_type: AppointmentCanonicalType | null;
  status: AppointmentStatus;
  complaint: string | null;
  notes: string | null;
  video_room_url: string | null;
  cancellation_reason: string | null;
  cancelled_by: CancelledBy;
  cancelled_at: string | null;
  payment_status: PaymentStatus;
  payment_amount: number | null;
  payment_id: string | null;
  escrow_status: EscrowStatus;
  refund_status: string | null;
  /** Timestamp until which the owner↔vet chat channel is open (null = not set / expired) */
  messaging_expires_at: string | null;
  created_at: string;
  pet?: Pet;
  vet?: Veterinarian & { user: User };
  owner?: User;
}

export interface MedicalRecord {
  id: string;
  appointment_id: string;
  voice_note_url: string | null;
  transcription: string | null;
  soap_notes: SOAPNotes | null;
  medications: Medication[] | null;
  follow_up_date: string | null;
  vet_notes: string | null;
  created_at?: string;
}

export interface SOAPNotes {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface Medication {
  name: string;
  dosage: string;
  duration: string;
  instructions: string;
}

export interface Vaccine {
  id: string;
  pet_id: string;
  name: string;
  given_date: string;
  next_due_date: string | null;
  vet_id: string | null;
  notes: string | null;
}

export interface WeightLog {
  id: string;
  pet_id: string;
  weight: number;
  recorded_at: string;
}

export interface PetPhoto {
  id: string;
  pet_id: string;
  photo_url: string;
  visit_date: string | null;
  caption: string | null;
}

export interface Review {
  id: string;
  vet_id: string;
  owner_id: string;
  rating: number;
  comment: string | null;
  is_approved: boolean;
  is_flagged: boolean;
  created_at: string;
  owner?: User;
}

export interface Subscription {
  id: string;
  vet_id: string;
  tier: 'basic' | 'pro' | 'premium';
  status: 'active' | 'cancelled' | 'past_due';
  iyzico_subscription_id: string | null;
  start_date: string;
  next_billing_date: string | null;
}

export interface Reminder {
  id: string;
  pet_id: string;
  owner_id: string;
  type: 'vaccine' | 'checkup' | 'medication' | 'appointment';
  scheduled_at: string;
  sent_at: string | null;
  message_content: string;
  delivery_status: 'pending' | 'sent' | 'failed';
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'emergency' | 'critical';

export interface SymptomCheck {
  id: string;
  owner_id: string;
  pet_id: string | null;
  symptoms_text: string;
  photo_url: string | null;
  ai_response: SymptomAnalysisResult | null;
  urgency_level: UrgencyLevel | null;
  created_at: string;
}

export interface QAPair {
  question: string;
  answer: string;
}

/**
 * SymptomAnalysisResult — matches the JSON schema returned by /api/symptom-check.
 *
 * The API is EDUCATIONAL ONLY (no triage, no urgency assessment).
 * All fields are optional with safe defaults to prevent runtime crashes
 * if the AI model omits a field.
 */
export interface SymptomAnalysisResult {
  topic_summary: string;
  general_info: string;
  common_causes: string[];
  care_notes: string[];
  questions_to_ask_vet: string[];
  disclaimer: string;
}

export interface Payment {
  id: string;
  vet_id: string;
  amount: number;
  type: 'subscription' | 'consultation';
  status: 'success' | 'failed' | 'refunded';
  iyzico_transaction_id: string | null;
  created_at: string;
}

export interface Dispute {
  id: string;
  review_id: string;
  vet_id: string;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  admin_decision: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  target_role: 'all' | 'owner' | 'vet';
  sent_at: string | null;
  created_by: string;
}

export interface ApiUsageLog {
  id: string;
  api_type: 'claude' | 'whisper' | 'whatsapp';
  tokens_used: number | null;
  cost_estimate: number | null;
  created_at: string;
}

export interface SystemError {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  stack_trace: string | null;
  created_at: string;
}
