import "server-only";
import type { AdminSession } from "./admin.server";
import { parsePoint } from "./directory";

const ADMIN_SELECT = `id, slug, name, description, address, phone, website, location, status, published, origin,
  source_url, needs_location, created_at, owner_edited_fields,
  possible_duplicate:possible_duplicate_of(id, slug, name),
  submission_private(submitter_email, ownership_note, created_at),
  business_categories(is_primary, categories(slug, name))`;

export type AdminBusiness = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  address: string;
  phone: string | null;
  website: string | null;
  point: { lat: number; lng: number } | null;
  status: "pending" | "approved" | "rejected";
  published: boolean;
  origin: "import" | "submission";
  sourceUrl: string | null;
  needsLocation: boolean;
  createdAt: string;
  ownerEditedFields: string[];
  possibleDuplicate: { id: string; slug: string; name: string } | null;
  submitter: { email: string; ownershipNote: string | null } | null;
  categories: { slug: string; name: string }[];
};

type Row = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  address: string;
  phone: string | null;
  website: string | null;
  location: unknown;
  status: AdminBusiness["status"];
  published: boolean;
  origin: AdminBusiness["origin"];
  source_url: string | null;
  needs_location: boolean;
  created_at: string;
  owner_edited_fields: string[];
  possible_duplicate: { id: string; slug: string; name: string } | null;
  submission_private: { submitter_email: string; ownership_note: string | null } | null;
  business_categories: { is_primary: boolean; categories: { slug: string; name: string } | null }[];
};

function toAdminBusiness(r: Row): AdminBusiness {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    address: r.address,
    phone: r.phone,
    website: r.website,
    point: parsePoint(r.location),
    status: r.status,
    published: r.published,
    origin: r.origin,
    sourceUrl: r.source_url,
    needsLocation: r.needs_location,
    createdAt: r.created_at,
    ownerEditedFields: r.owner_edited_fields,
    possibleDuplicate: r.possible_duplicate,
    submitter: r.submission_private
      ? { email: r.submission_private.submitter_email, ownershipNote: r.submission_private.ownership_note }
      : null,
    categories: [...r.business_categories]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
      .flatMap((c) => (c.categories ? [c.categories] : [])),
  };
}

export async function listByStatus(admin: AdminSession, status: "pending" | "rejected"): Promise<AdminBusiness[]> {
  const { data, error } = await admin.db
    .from("businesses")
    .select(ADMIN_SELECT)
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" });
  if (error) throw error;
  return (data as unknown as Row[]).map(toAdminBusiness);
}

export async function searchBusinesses(admin: AdminSession, q: string): Promise<AdminBusiness[]> {
  let query = admin.db.from("businesses").select(ADMIN_SELECT).neq("status", "pending").order("name").limit(200);
  const term = q.trim().replace(/[%_,()]/g, " ");
  if (term) query = query.or(`name.ilike.%${term}%,address.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as Row[]).map(toAdminBusiness);
}

export async function getAdminBusiness(admin: AdminSession, id: string): Promise<AdminBusiness | null> {
  const { data, error } = await admin.db.from("businesses").select(ADMIN_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toAdminBusiness(data as unknown as Row) : null;
}

export type HistoryEntry = { id: number; actor: string; action: string; reason: string | null; diff: unknown; at: string };

export async function getHistory(admin: AdminSession, id: string): Promise<HistoryEntry[]> {
  const { data, error } = await admin.db
    .from("moderation_events")
    .select("id, actor, action, reason, diff, at")
    .eq("business_id", id)
    .order("at", { ascending: false });
  if (error) throw error;
  return data;
}
