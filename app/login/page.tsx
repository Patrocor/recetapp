"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setError("");

    const supabase = createClient();
    const email = usernameToEmail(username);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Usuario o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    // Check if access is active and not expired
    const { data: ua } = await supabase
      .from("user_access")
      .select("active, exp_at")
      .eq("username", username.toLowerCase())
      .single();

    if (ua) {
      if (!ua.active) {
        await supabase.auth.signOut();
        setError("Tu acceso está suspendido. Contacta al administrador.");
        setLoading(false);
        return;
      }
      if (ua.exp_at && new Date(ua.exp_at).getTime() < Date.now()) {
        await supabase.auth.signOut();
        setError("Tu acceso ha expirado. Contacta al administrador.");
        setLoading(false);
        return;
      }
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(145deg,#04313A 0%,#09707F 60%,#0DA8C0 100%)" }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-9 text-center"
        style={{ boxShadow: "0 28px 80px rgba(4,49,58,.4)" }}>

        {/* Logo */}
        <div className="mx-auto mb-5 w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#04313A,#0E9BB0)" }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path d="M18 6v24M6 18h24" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
            <circle cx="18" cy="18" r="15" stroke="white" strokeWidth="2" opacity=".4"/>
          </svg>
        </div>

        <h1 className="font-serif text-2xl font-normal mb-1" style={{ color: "#04313A" }}>
          RecetAPP
        </h1>
        <p className="text-xs mb-7" style={{ color: "#9CA3AF" }}>
          Documentos Médicos Digitales · Perú
        </p>

        <form onSubmit={handleLogin} className="text-left space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide mb-1"
              style={{ color: "#4A5568" }}>
              Usuario
            </label>
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin(e)}
              className="w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition"
              style={{ background: "#F4F1EC", borderColor: "#E5E0D7" }}
              placeholder="tu-usuario"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide mb-1"
              style={{ color: "#4A5568" }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition"
              style={{ background: "#F4F1EC", borderColor: "#E5E0D7" }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-3 rounded-lg text-white font-semibold text-[15px] transition disabled:opacity-50 mt-1"
            style={{ background: loading ? "#09707F" : "#09707F" }}
            onMouseEnter={(e) => !loading && ((e.target as HTMLElement).style.background = "#04313A")}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.background = "#09707F")}
          >
            {loading ? "Verificando…" : "Ingresar →"}
          </button>
        </form>

        <p className="text-[11px] mt-6" style={{ color: "#9CA3AF" }}>
          v8.4 · Solo acceso autorizado
        </p>
      </div>
    </div>
  );
}
