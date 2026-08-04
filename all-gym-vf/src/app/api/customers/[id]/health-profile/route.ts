import { NextRequest } from "next/server";
import {
  customerHealthProfileSchema,
  customerHealthProfileUpdateSchema,
  customerIdSchema,
} from "@/features/customers/lib/customer-health";
import {
  invalidSensitiveCustomersRequest,
  proxySensitiveCustomersGet,
  proxySensitiveCustomersMutation,
} from "../../_lib";

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!customerIdSchema.safeParse(id).success) return invalidSensitiveCustomersRequest();
  return proxySensitiveCustomersGet(request, `/customers/${id}/health-profile`, customerHealthProfileSchema);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!customerIdSchema.safeParse(id).success) return invalidSensitiveCustomersRequest();
  return proxySensitiveCustomersMutation(request, `/customers/${id}/health-profile`, {
    method: "PATCH",
    inputSchema: customerHealthProfileUpdateSchema,
    responseSchema: customerHealthProfileSchema,
  });
}
