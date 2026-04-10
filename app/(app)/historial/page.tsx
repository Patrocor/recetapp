"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { DocRecord } from "@/types";

const BADGE: Record<string, { label: string; cls: string }> = {
  receta:  { label: "💊 Receta",      cls: "bg-blue-100 text-blue-800" },
  orden:   { label: "🧪 Orden",        cls: "bg-purple-100 text-purple-800" },
  const:   { label: "📋 Constancia",   cls: "bg-amber-100 text-amber-800" },
  cert:    { label: "🏥 Certificado",  cls: "bg-green-100 text-green-800" },
};

export default function HistorialPage() {
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) setDocs(data as DocRecord[]);
        setLoading(false);
      });
  }, []);

  async function deleteDoc(id: string) {
    if (!confirm("¿Eliminar este registro del historial?")) return;
    const supabase = createClient();
    await supabase.from("documents").delete().eq("id", id);
    setDocs((d) => d.filter((x) => x.id !== id));
  }

  if (loading) {
    return <div className="text-center py-16 text-[var(--ink3)]">Cargando historial…</div>;
  }

  if (!docs.length) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">📂</p>
        <p className="text-[var(--ink3)]">No hay documentos generados aún</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--ink)]">📂 Historial</h2>
        <span className="text-xs text-[var(--ink3)]">{docs.length} documentos</span>
      </div>

      {docs.map((doc) => {
        const badge = BADGE[doc.tipo] || { label: doc.tipo, cls: "bg-gray-100 text-gray-700" };
        const date = new Date(doc.created_at).toLocaleDateString("es-PE", {
          day: "2-digit", month: "short", year: "numeric",
        });
        return (
          <div key={doc.id} className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                    {badge.label}
                  </span>
                  <span className="text-xs text-[var(--ink3)]">{date}</span>
                  {doc.folio && (
                    <span className="text-xs font-mono bg-[var(--bg)] border border-[var(--brd)] px-2 py-0.5 rounded">
                      {doc.folio}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-[var(--ink)] truncate">{doc.paciente || "—"}</p>
                {doc.diagnostico && (
                  <p className="text-xs text-[var(--ink3)] truncate">{doc.diagnostico}</p>
                )}
              </div>
              <button
                onClick={() => deleteDoc(doc.id)}
                className="text-xs text-[var(--ink3)] hover:text-red-500 transition shrink-0"
              >
                Eliminar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
