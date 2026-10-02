import { cookies } from "next/headers";

import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";

type Context = { params: Promise<{ kind: string; filename: string }> };

const filenamePattern = /^[a-f0-9]{64}\.(png|jpg|webp|gif)$/;

export async function GET(_request: Request, context: Context) {
  const { kind, filename } = await context.params;
  if (!["exercises", "products", "avatars"].includes(kind) || !filenamePattern.test(filename)) {
    return new Response("Imagen inválida", { status: 400 });
  }

  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());

  try {
    const upstream = await fetchAuthBackend(`/media/${kind}/${filename}`, {
      method: "GET",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    if (!upstream.ok) return new Response(null, { status: upstream.status });
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Servicio local de imágenes no disponible", { status: 502 });
  }
}
