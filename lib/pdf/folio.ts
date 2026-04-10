import { createClient } from "@/lib/supabase/client";

export async function generateFolio(
  patientName: string,
  type: "R" | "O" | "Co" | "Cer"
): Promise<string> {
  const initials = patientName
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase() ?? "X")
    .join("") || "XX";

  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("increment_counter", { p_type: type });
    if (error || data == null) throw new Error("rpc failed");
    const num = String(Number(data)).padStart(5, "0");
    return `${initials}-${type}-${num}`;
  } catch {
    // Fallback: timestamp-based folio
    return `${initials}-${type}-${Date.now().toString().slice(-5)}`;
  }
}
