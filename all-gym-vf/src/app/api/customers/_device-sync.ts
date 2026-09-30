import { reconcileLocalCustomerOnClock } from "@/features/cash/lib/local-device-sync";
import { customerDetailSchema } from "@/features/customers/lib/local-customers";

export async function reconcileCustomerMutation<T extends Response>(
  response: T,
  customerId?: string,
): Promise<T> {
  if (!response.ok) return response;

  let id = customerId;
  if (!id) {
    const detail = customerDetailSchema.safeParse(await response.clone().json().catch(() => null));
    if (!detail.success) return response;
    id = detail.data.id;
  }

  const result = await reconcileLocalCustomerOnClock(id);
  if (!result.synced) {
    console.warn("[device-sync] La reconciliación local quedó pendiente", { customerId: id });
  }
  return response;
}
