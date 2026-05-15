import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRoutineWorkspace } from "@/features/customers/actions/customer-routine-actions";
import type {
  ClientApiEnvelope,
  ClientMembershipHistoryEntry,
  ClientMembershipPayload,
  ClientOverviewSummary,
  ClientProfilePayload,
  ClientRoutinePayload,
} from "@/features/client/types";

function withMeta<T>(data: T): ClientApiEnvelope<T> {
  return {
    data,
    meta: {
      fetched_at: new Date().toISOString(),
    },
  };
}

async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("UNAUTHORIZED");
  }

  return {
    supabase,
    adminClient: createAdminClient(),
    user,
  };
}

function getPlanSummary(planRef: unknown): { name?: string | null; price?: number | null } | null {
  if (!planRef) return null;
  if (Array.isArray(planRef)) {
    return (planRef[0] as { name?: string | null; price?: number | null } | undefined) ?? null;
  }

  return planRef as { name?: string | null; price?: number | null };
}

async function getCurrentOverview(adminClient: ReturnType<typeof createAdminClient>, userId: string): Promise<ClientOverviewSummary | null> {
  const { data, error } = await adminClient
    .from("customer_overview")
    .select(
      "full_name, phone, avatar_url, gender, birth_date, plan_name, subscription_status, subscription_start_date, subscription_end_date, last_check_in, is_active",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error loading customer overview:", error);
    return null;
  }

  return (data as ClientOverviewSummary | null) ?? null;
}

export async function getCurrentClientProfileData(): Promise<ClientApiEnvelope<ClientProfilePayload>> {
  const { user, adminClient } = await requireAuthenticatedUser();
  const [{ data: profile, error: profileError }, overview] = await Promise.all([
    adminClient
      .from("profiles")
      .select("full_name, phone, birth_date, gender, avatar_url, role, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle(),
    getCurrentOverview(adminClient, user.id),
  ]);

  if (profileError) {
    console.error("Error loading current profile:", profileError);
  }

  return withMeta({
    id: user.id,
    email: user.email || "",
    full_name:
      typeof profile?.full_name === "string"
        ? profile.full_name
        : typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : null,
    phone: typeof profile?.phone === "string" ? profile.phone : null,
    birth_date: typeof profile?.birth_date === "string" ? profile.birth_date : null,
    gender: typeof profile?.gender === "string" ? profile.gender : null,
    avatar_url:
      typeof profile?.avatar_url === "string"
        ? profile.avatar_url
        : typeof user.user_metadata?.avatar_url === "string"
          ? user.user_metadata.avatar_url
          : null,
    role: typeof profile?.role === "string" ? profile.role : typeof user.user_metadata?.role === "string" ? user.user_metadata.role : null,
    created_at: typeof profile?.created_at === "string" ? profile.created_at : user.created_at,
    updated_at: typeof profile?.updated_at === "string" ? profile.updated_at : null,
    overview,
  });
}

export async function getCurrentClientMembershipData(): Promise<ClientApiEnvelope<ClientMembershipPayload>> {
  const { user, adminClient } = await requireAuthenticatedUser();
  const [overview, subscriptionsResponse] = await Promise.all([
    getCurrentOverview(adminClient, user.id),
    adminClient
      .from("subscriptions")
      .select(
        `
        id,
        start_date,
        end_date,
        status,
        discount_amount,
        plan_id,
        plans!inner (
          name,
          price
        )
      `,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (subscriptionsResponse.error) {
    throw subscriptionsResponse.error;
  }

  const subscriptions: ClientMembershipHistoryEntry[] = (subscriptionsResponse.data || []).map((subscription) => {
    const plan = getPlanSummary(subscription.plans);

    return {
      id: subscription.id,
      plan_id: typeof subscription.plan_id === "number" ? subscription.plan_id : null,
      plan_name: plan?.name || "Plan",
      start_date: subscription.start_date,
      end_date: subscription.end_date,
      status: subscription.status,
      price: plan?.price || 0,
      discount_amount: subscription.discount_amount || 0,
    };
  });

  return withMeta({
    overview,
    subscriptions,
  });
}

export async function getCurrentClientRoutineData(): Promise<ClientApiEnvelope<ClientRoutinePayload>> {
  const { user, adminClient } = await requireAuthenticatedUser();
  const [workspace, overview] = await Promise.all([
    getCurrentUserRoutineWorkspace(),
    getCurrentOverview(adminClient, user.id),
  ]);

  return withMeta({
    customer_name: overview?.full_name || user.user_metadata?.full_name || "Cliente",
    workspace,
  });
}
