import { NextRequest } from "next/server";
import {
  bodyAssessmentCreateSchema,
  bodyAssessmentsQuerySchema,
  bodyAssessmentsResponseSchema,
  customerBodyAssessmentSchema,
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
  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  if (!customerIdSchema.safeParse(id).success || !bodyAssessmentsQuerySchema.safeParse(query).success) {
    return invalidSensitiveCustomersRequest();
  }
  return proxySensitiveCustomersGet(
    request,
    `/customers/${id}/body-assessments`,
    bodyAssessmentsResponseSchema,
    ["page", "page_size"],
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  if (!customerIdSchema.safeParse(id).success) return invalidSensitiveCustomersRequest();
  return proxySensitiveCustomersMutation(request, `/customers/${id}/body-assessments`, {
    method: "POST",
    inputSchema: bodyAssessmentCreateSchema,
    responseSchema: customerBodyAssessmentSchema,
  });
}
