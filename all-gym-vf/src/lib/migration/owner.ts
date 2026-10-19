import { createClient } from "@/lib/supabase/server";

// Exporting includes private records: never fall back to editable user_metadata.
export async function getExportOwner() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await supabase.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
  if (profile?.role !== "owner" || profile.is_active !== true) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.id !== user.id) return null;
  return { id: user.id, token: session.access_token };
}
