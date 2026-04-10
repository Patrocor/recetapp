"use client";

import { useState, useRef, useEffect } from "react";
import { medDB, MedDBEntry } from "@/lib/data/medicamentos";

interface Props {
  onSelect: (entry: MedDBEntry) => void;
}

function scoreMed(m: MedDBEntry, t: string): number {
  const dl = m.d.toLowerCase();
  const ml = m.m.map((x) => x.toLowerCase());
  const pl = m.p.toLowerCase();
  const gl = m.g.toLowerCase();
  if (dl === t) return 12;
  if (ml.some((x) => x === t)) return 11;
  if (dl.startsWith(t)) return 10;
  if (ml.some((x) => x.startsWith(t))) return 9;
  if (dl.includes(t)) return 7;
  if (gl.includes(t)) return 6;
  if (ml.some((x) => x.includes(t))) return 5;
  if (ml.some((x) => x.split(" ").some((w) => w.startsWith(t)))) return 4;
  if (pl.includes(t)) return 3;
  return -1;
}

function hlWord(s: string, t: string) {
  if (!t) return s;
  const i = s.toLowerCase().indexOf(t);
  if (i < 0) return s;
  return s.slice(0, i) + "<mark>" + s.slice(i, i + t.length) + "</mark>" + s.slice(i + t.length);
}

export default function MedSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MedDBEntry[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleInput(v: string) {
    setQuery(v);
    const t = v.trim().toLowerCase();
    if (t.length < 3) { setResults([]); setOpen(false); return; }
    const res = medDB
      .map((m) => ({ m, s: scoreMed(m, t) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.m.d.localeCompare(b.m.d, "es"))
      .slice(0, 70)
      .map((x) => x.m);
    setResults(res);
    setOpen(res.length > 0);
  }

  function select(m: MedDBEntry) {
    onSelect(m);
    setQuery(m.d + " · " + m.p);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => query.trim() && results.length && setOpen(true)}
        placeholder="Busca medicamento (nombre genérico o marca)…"
        className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition bg-[var(--bg)] border-[var(--brd)]"
      />
      {open && (
        <div className="sug">
          {results.map((m, i) => {
            const t = query.trim().toLowerCase();
            const matchedBrand = m.m.find((b) => b.toLowerCase().includes(t));
            const brands = matchedBrand
              ? [matchedBrand, ...m.m.filter((b) => b !== matchedBrand)].slice(0, 4)
              : m.m.slice(0, 4);
            return (
              <div key={i} className="si" onMouseDown={() => select(m)}>
                <span className="sin" dangerouslySetInnerHTML={{ __html: hlWord(m.d, t) }} />
                <span className="sis">{m.p} · <span className="text-[var(--ink2)]">{m.g}</span></span>
                <span className="sis mt-0.5">
                  <span className="text-[10px] font-bold text-[var(--ink3)] uppercase tracking-wide">Marcas: </span>
                  <em className="text-teal-600" dangerouslySetInnerHTML={{ __html: brands.map((b) => hlWord(b, t)).join(", ") }} />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
