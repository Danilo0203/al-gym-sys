import { NextRequest } from "next/server";
import {
  bodyAssessmentIdSchema,
  bodyAssessmentUpdateSchema,
  customerBodyAssessmentSchema,
  customerIdSchema,
} from "@/features/customers/lib/customer-health";
import { invalidSensitiveCustomersRequest, proxySensitiveCustomersMutation } from "../../../_lib";

interface RouteContext { params: Promise<{ id: string; assessmentId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id, assessmentId } = await context.params;
  if (!customerIdSchema.safeParse(id).success || !bodyAssessmentIdSchema.safeParse(assessmentId).success) {
    return invalidSensitiveCustomersRequest();
  }
  return proxySensitiveCustomersMutation(
    request,
    `/customers/${id}/body-assessments/${assessmentId}`,
    {
      method: "PATCH",
      inputSchema: bodyAssessmentUpdateSchema,
      responseSchema: customerBodyAssessmentSchema,
    },
  );
}
