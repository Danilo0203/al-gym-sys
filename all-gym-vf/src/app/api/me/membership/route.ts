import { getCurrentClientMembershipData } from "@/features/client/server/client-data";

function mapErrorToStatus(error: unknown) {
  return error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
}

export async function GET() {
  try {
    return Response.json(await getCurrentClientMembershipData(), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = mapErrorToStatus(error);
    return Response.json(
      {
        error: status === 401 ? "unauthorized" : "membership_unavailable",
      },
      { status },
    );
  }
}
