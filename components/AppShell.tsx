"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DoctorProfile } from "@/types";
import ProfileModal from "@/components/ProfileModal";
import { cn } from "@/lib/utils";

interface Props {
  profile: DoctorProfile;
  isAdmin: boolean;
  children: React.ReactNode;
}

const TABS = [
  { id: "receta",      label: "Receta",      icon: "💊", path: "/receta" },
  { id: "orden",       label: "Orden",        icon: "🧪", path: "/orden" },
  { id: "constancia",  label: "Constancia",   icon: "📋", path: "/constancia" },
  { id: "certificado", label: "Certificado",  icon: "🏥", path: "/certificado" },
  { id: "historial",   label: "Historial",    icon: "📂", path: "/historial" },
];

export default function AppShell({ profile, isAdmin, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<DoctorProfile>(profile);

  async function handleLogout() {
    if (!confirm("¿Cerrar sesión?")) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const h = new Date().getHours();
  const greeting = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      {/* ── Topbar ── */}
      <header className="sticky top-0 z-40 border-b border-[var(--brd)] bg-[var(--card)] shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Logo + greeting */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#04313A,#0E9BB0)" }}>
              <svg width="18" height="18" viewBox="0 0 36 36" fill="none">
                <path d="M18 6v24M6 18h24" stroke="white" strokeWidth="4" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="min-w-0 hidden sm:block">
              <p className="text-xs font-semibold text-[var(--ink)] leading-none truncate">
                {greeting}, {currentProfile.nombre?.split(" ")[0] || "Doctor/a"}
              </p>
              <p className="text-[11px] text-[var(--ink3)] truncate">
                CMP: {currentProfile.cmp || "—"}
                {currentProfile.especialidad ? ` · ${currentProfile.especialidad}` : ""}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <Link href="/admin"
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--brd)] hover:bg-[var(--bg2)] transition text-[var(--ink2)]">
                Admin
              </Link>
            )}
            <button
              onClick={() => setProfileOpen(true)}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--brd)] hover:bg-[var(--bg2)] transition text-[var(--ink2)]"
            >
              Perfil
            </button>
            <button
              onClick={handleLogout}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--brd)] hover:bg-[var(--bg2)] transition text-[var(--ink2)]"
            >
              Salir
            </button>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="max-w-4xl mx-auto px-2 flex overflow-x-auto gap-0.5 pb-0 scrollbar-hide">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.path}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition shrink-0",
                pathname === t.path || pathname.startsWith(t.path + "/")
                  ? "border-teal-700 text-teal-800"
                  : "border-transparent text-[var(--ink3)] hover:text-[var(--ink2)]"
              )}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </Link>
          ))}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* ── Profile modal ── */}
      {profileOpen && (
        <ProfileModal
          profile={currentProfile}
          onClose={() => setProfileOpen(false)}
          onSaved={(p) => { setCurrentProfile(p); setProfileOpen(false); }}
        />
      )}
    </div>
  );
}
