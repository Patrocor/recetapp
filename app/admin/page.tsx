import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminPanel from "./AdminPanel";

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, username")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/");

  // Fetch all users
  const { data: users } = await supabase
    .from("user_access")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch doc counts per user
  const { data: docCounts } = await supabase
    .from("documents")
    .select("user_id");

  // Fetch recent log
  const { data: log } = await supabase
    .from("admin_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  // Count docs per user
  const countMap: Record<string, number> = {};
  (docCounts || []).forEach((d) => {
    countMap[d.user_id] = (countMap[d.user_id] || 0) + 1;
  });

  return (
    <AdminPanel
      users={users || []}
      docCountMap={countMap}
      log={log || []}
      adminUsername={profile.username}
    />
  );
}
