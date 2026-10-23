import { cookies } from "next/headers";

import { buildCookieHeader, fetchAuthBackend } from "@/lib/auth/backend-auth";

type Context = { params: Promise<{ kind: string; filename: string }> };

const filenamePattern = /^[a-f0-9]{64}\.(png|jpg|webp|gif)$/;
const exerciseFilenamePattern = /^[a-f0-9]{64}\.(png|jpg|webp|gif|mp4)$/;

export async function GET(request: Request, context: Context) {
  const { kind, filename } = await context.params;
  const allowedFilename = kind === "exercises" ? exerciseFilenamePattern : filenamePattern;
  if (!["exercises", "products", "avatars"].includes(kind) || !allowedFilename.test(filename)) {
    return new Response("Archivo inválido", { status: 400 });
  }

  const cookieStore = await cookies();
  const cookieHeader = buildCookieHeader(cookieStore.getAll());

  try {
    const upstream = await fetchAuthBackend(`/media/${kind}/${filename}`, {
      method: "GET",
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(request.headers.has("range") ? { range: request.headers.get("range")! } : {}),
      },
    });
    const headers = new Headers({ "X-Content-Type-Options": "nosniff" });
    for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (!upstream.ok) {
      headers.delete("content-length");
      headers.set("cache-control", "no-store");
      return new Response(null, { status: upstream.status, headers });
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return new Response("Servicio local de archivos no disponible", { status: 502 });
  }
}
