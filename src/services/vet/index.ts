/**
 * Vet Service Layer — barrel export.
 *
 * Types:   import { VetToggleState, ToggleType, ... } from '@/services/vet';
 * Queries: import { getDashboardMetrics, ... } from '@/services/vet';
 * Mutations: import { toggleVetStatus, ... } from '@/services/vet';
 */

// Types
export * from './vetTypes';

// Server-side queries (use in Server Components only)
export { getVetDashboardProfile, getDashboardMetrics } from './vetQueries';

// Client-side mutations (use in Client Components and hooks)
export {
  toggleVetStatus,
  sendHeartbeat,
  confirmAppointment,
  cancelAppointment,
  completeAppointment,
} from './vetMutations';
