import { NextResponse, type NextRequest } from "next/server";
import { geocode, suggest } from "@/lib/geocode";

// Location search for the map. GET /api/geocode?q=Astoria%2C%20NY[&suggest=1]
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 200) ?? "";
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });
  try {
    if (req.nextUrl.searchParams.get("suggest")) {
      return NextResponse.json({ suggestions: await suggest(q) });
    }
    const hit = await geocode(q);
    return hit ? NextResponse.json(hit) : NextResponse.json({ error: "location not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "geocoding unavailable" }, { status: 502 });
  }
}
