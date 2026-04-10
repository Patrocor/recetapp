import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre")
    .eq("id", user.id)
    .single();

  if (!profile?.nombre) redirect("/setup");
  redirect("/receta");
}
