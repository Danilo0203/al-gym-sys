import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CustomerTable } from "./customer-tables/customer-table";
import { Customer } from "./customer-tables/columns";
import { searchParamsCache } from "@/lib/searchparams";
import { getSubscriptionAccessUntilISO, todayLocalISO } from "@/lib/subscriptions/grace-period";
import { getUserAccessContext, hasPermission } from "@/lib/auth/authorization";

export default async function CustomerListingPage() {
  const access = await getUserAccessContext();
  const canUpdate = hasPermission(access, "customers.update");

  const page = searchParamsCache.get("page");
  const pageLimit = searchParamsCache.get("perPage");
  const fullName = searchParamsCache.get("full_name");
  const planName = searchParamsCache.get("plan_name");
  const isActive = searchParamsCache.get("is_active");
  const subscriptionStatus = searchParamsCache.get("subscription_status");
  const role = searchParamsCache.get("role") || "client";
  const sort = searchParamsCache.get("sort"); // Expecting format: "column.dir" (e.g., "full_name.asc")

  const filters = {
    page,
    limit: pageLimit,
    role,
    ...(fullName && { full_name: fullName }),
    ...(planName && { plan_name: planName }),
    ...(isActive && { is_active: isActive }),
    ...(subscriptionStatus && { subscription_status: subscriptionStatus }),
  };

  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Actualizar automáticamente suscripciones vencidas respetando la prórroga.
  const today = todayLocalISO();
  const { data: activeSubscriptions, error: expireFetchError } = await adminClient
    .from("subscriptions")
    .select("id, end_date, grace_days")
    .eq("status", "active");

  if (expireFetchError) {
    console.error("Error fetching subscriptions to expire:", {
      code: expireFetchError.code,
      message: expireFetchError.message,
      details: expireFetchError.details,
      hint: expireFetchError.hint,
    });
  } else {
    const expiredSubscriptionIds = (activeSubscriptions || [])
      .filter((subscription) => {
        const accessUntil = getSubscriptionAccessUntilISO(subscription.end_date, subscription.grace_days);
        return accessUntil !== null && accessUntil < today;
      })
      .map((subscription) => subscription.id);

    if (expiredSubscriptionIds.length > 0) {
      const { error: expireUpdateError } = await adminClient
        .from("subscriptions")
        .update({ status: "expired" })
        .in("id", expiredSubscriptionIds);

      if (expireUpdateError) {
        console.error("Error expiring subscriptions:", {
          code: expireUpdateError.code,
          message: expireUpdateError.message,
          details: expireUpdateError.details,
          hint: expireUpdateError.hint,
        });
      }
    }
  }

  // Obtener la lista de planes para el filtro
  const { data: plans } = await supabase.from("plans").select("id, name").order("name");

  // Crear opciones para el filtro multiSelect
  const planOptions = (plans || []).map((plan) => ({
    label: plan.name,
    value: plan.name,
  }));

  // Query para clientes
  let query = supabase
    .from("customer_overview")
    .select(
      "id, full_name, phone, avatar_url, role, subscription_status, subscription_start_date, subscription_end_date, subscription_grace_days, subscription_access_until, plan_name, last_check_in, is_active",
      { count: "exact" },
    );

  if (filters.role) {
    query = query.eq("role", filters.role);
  }

  if (filters.full_name) {
    query = query.ilike("full_name", `%${filters.full_name}%`);
  }

  // Filtro por estado del cliente (Active/Inactive)
  if (filters.is_active) {
    const statusValues = filters.is_active.split(",");
    if (statusValues.length === 1) {
      query = query.eq("is_active", statusValues[0] === "Active");
    } else if (statusValues.length > 1) {
      const boolValues = statusValues.map((s) => s === "Active");
      query = query.in("is_active", boolValues);
    }
  }

  // Filtro por estado de suscripción
  if (filters.subscription_status) {
    const subscriptionStatuses = filters.subscription_status
      .split(",")
      .filter(Boolean);

    if (subscriptionStatuses.length > 0) {
      query = query.in("subscription_status", subscriptionStatuses);
    }
  }

  // Filtro por plan (puede ser múltiple, separado por comas)
  if (filters.plan_name) {
    const planNames = filters.plan_name.split(",");
    query = query.in("plan_name", planNames);
  }

  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  // Sorting
  const allowedSortColumns = new Set([
    "full_name",
    "is_active",
    "subscription_status",
    "plan_name",
    "subscription_start_date",
    "subscription_end_date",
    "phone",
    "last_check_in",
  ]);
  let hasAppliedSort = false;
  if (sort && sort.length > 0) {
    sort.forEach((s) => {
      if (allowedSortColumns.has(s.id)) {
        query = query.order(s.id, { ascending: !s.desc, nullsFirst: false });
        hasAppliedSort = true;
      }
    });
  }

  if (!hasAppliedSort) {
    query = query.order("subscription_status", { ascending: true });
  }

  query = query.range(from, to);

  const { data: customers, error, count } = await query;

  if (error) {
    console.error("Error fetching customers (view):", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  }

  const totalitems = count || 0;
  const customerRows = ((customers as Customer[]) || []).filter(Boolean);
  const customerIds = customerRows.map((customer) => customer.id);

  let enrichedCustomers = customerRows;

  if (customerIds.length > 0) {
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id, biometric_id, created_at")
      .in("id", customerIds);

    if (profilesError) {
      console.error("Error fetching customer biometric ids:", profilesError);
    } else {
      const biometricIdByCustomerId = new Map(
        (profiles || []).map((profile) => [profile.id, profile.biometric_id as number | null]),
      );
      const createdAtByCustomerId = new Map(
        (profiles || []).map((profile) => [profile.id, typeof profile.created_at === "string" ? profile.created_at : null]),
      );
      const baseEnrichedCustomers = customerRows.map((customer) => ({
        ...customer,
        biometric_id: biometricIdByCustomerId.get(customer.id) ?? null,
        created_at: createdAtByCustomerId.get(customer.id) || null,
      }));

      const biometricIds = Array.from(
        new Set(
          (profiles || [])
            .map((profile) => profile.biometric_id)
            .filter((value): value is number => Number.isInteger(value)),
        ),
      );

      if (biometricIds.length > 0) {
        const { data: attendanceRows, error: attendanceError } = await adminClient
          .from("attendance_logs")
          .select("biometric_id, punch_time, status1")
          .in("biometric_id", biometricIds)
          .order("punch_time", { ascending: false });

        if (attendanceError && attendanceError.code !== "42P01") {
          console.error("Error fetching latest attendance logs:", attendanceError);
        } else if (attendanceRows) {
          const latestAttendanceByBiometricId = new Map<number, string>();

          for (const row of attendanceRows) {
            if (row.status1 != null && row.status1 !== 0) {
              continue;
            }
            if (!latestAttendanceByBiometricId.has(row.biometric_id)) {
              latestAttendanceByBiometricId.set(row.biometric_id, row.punch_time);
            }
          }

          enrichedCustomers = baseEnrichedCustomers.map((customer) => {
            const biometricId = customer.biometric_id;
            const latestAttendance =
              biometricId != null
                ? latestAttendanceByBiometricId.get(biometricId) || null
                : null;

            return {
              ...customer,
              last_check_in: latestAttendance || customer.last_check_in || null,
            };
          });
        } else {
          enrichedCustomers = baseEnrichedCustomers;
        }
      } else {
        enrichedCustomers = baseEnrichedCustomers;
      } 
    }
  }

  return <CustomerTable data={enrichedCustomers} totalItems={totalitems} planOptions={planOptions} canUpdate={canUpdate} />;
}
