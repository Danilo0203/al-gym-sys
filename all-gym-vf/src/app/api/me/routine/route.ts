import { getCurrentClientRoutineData } from "@/features/client/server/client-data";

function mapErrorToStatus(error: unknown) {
  return error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
}

export async function GET() {
  try {
    return Response.json(await getCurrentClientRoutineData(), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = mapErrorToStatus(error);
    return Response.json(
      {
        error: status === 401 ? "unauthorized" : "routine_unavailable",
      },
      { status },
    );
  }
}
