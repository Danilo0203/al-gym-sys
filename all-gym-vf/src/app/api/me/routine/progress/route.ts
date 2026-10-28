import { fetchAuthBackend } from "@/lib/auth/backend-auth";
import { exerciseCompletionSchema, resetRoutineDaySchema, routineProgressSchema } from "@/features/client/lib/routine-progress";

const headers = { "cache-control": "no-store" };

async function mutate(request: Request, reset: boolean) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = (reset ? resetRoutineDaySchema : exerciseCompletionSchema).safeParse(body);
  if (!parsed.success) return Response.json({ error: "Revisa los datos del ejercicio o del día." }, { status: 400, headers });
  const input = parsed.data;
  const resetting = "day" in input;
  const path = resetting
    ? `/me/routine/${input.routineId}/days/${input.day}/completion`
    : `/me/routine/${input.routineId}/details/${input.detailId}/completion`;
  try {
    const upstream = await fetchAuthBackend(path, {
      method: resetting ? "DELETE" : "PUT",
      headers: { "content-type": "application/json", cookie: request.headers.get("cookie") ?? "" },
      body: resetting ? undefined : JSON.stringify({ completed: input.completed }),
    });
    if (!upstream.ok) {
      const error = upstream.status === 401 ? "Tu sesión expiró. Vuelve a iniciar sesión."
        : upstream.status === 404 ? "La rutina cambió. Actualiza la página e inténtalo de nuevo."
          : "No se pudo guardar tu avance. Inténtalo de nuevo.";
      return Response.json({ error }, { status: upstream.status, headers });
    }
    const result = routineProgressSchema.parse(await upstream.json());
    return Response.json(result, { headers });
  } catch {
    return Response.json({ error: "No se pudo guardar tu avance. Revisa la conexión con el gimnasio e inténtalo de nuevo." }, { status: 503, headers });
  }
}

export function PUT(request: Request) { return mutate(request, false); }
export function DELETE(request: Request) { return mutate(request, true); }
