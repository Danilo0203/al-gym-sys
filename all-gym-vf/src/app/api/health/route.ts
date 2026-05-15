export async function GET() {
  return Response.json({
    ok: true,
    service: "web",
    timestamp: new Date().toISOString(),
  });
}
