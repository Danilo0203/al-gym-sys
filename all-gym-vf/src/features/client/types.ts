import type { CustomerRoutineWorkspace } from "@/lib/training/types";

export interface ClientApiMeta {
  fetched_at: string;
}

export interface ClientApiEnvelope<T> {
  data: T;
  meta: ClientApiMeta;
}

export interface ClientOverviewSummary {
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  gender: string | null;
  birth_date: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  subscription_grace_days?: number | null;
  subscription_access_until?: string | null;
  last_check_in: string | null;
  is_active: boolean | null;
}

export interface ClientProfilePayload {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  birth_date: string | null;
  gender: string | null;
  avatar_url: string | null;
  role: string | null;
  created_at: string;
  updated_at: string | null;
  overview: ClientOverviewSummary | null;
}

export interface ClientMembershipHistoryEntry {
  id: string;
  plan_id: number | null;
  plan_name: string;
  start_date: string;
  end_date: string;
  grace_days?: number | null;
  access_until?: string | null;
  status: string;
  price: number;
  discount_amount: number;
}

export interface ClientMembershipPayload {
  overview: ClientOverviewSummary | null;
  subscriptions: ClientMembershipHistoryEntry[];
}

export interface ClientRoutinePayload {
  customer_name: string;
  workspace: CustomerRoutineWorkspace;
}
