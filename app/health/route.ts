import packageJson from "@/package.json";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      status: "ok",
      service: "servicecore-web",
      version: packageJson.version,
      timestamp: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store, max-age=0", "x-content-type-options": "nosniff" } },
  );
}
