"use client";

import { useState, useRef, useEffect } from "react";
import { cie10, Cie10Entry } from "@/lib/data/cie10";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

function highlight(str: string, term: string) {
  const i = str.toLowerCase().indexOf(term);
  if (i < 0) return str;
  return str.slice(0, i) + "【" + str.slice(i, i + term.length) + "】" + str.slice(i + term.length);
}

export default function DxSearch({ value, onChange, placeholder, id }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Cie10Entry[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

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
    if (!t) { setResults([]); setOpen(false); return; }
    const matched = cie10.filter(
      (d) => d.c.toLowerCase().includes(t) || d.d.toLowerCase().includes(t)
    ).slice(0, 50);
    setResults(matched);
    setOpen(matched.length > 0);
  }

  function select(d: Cie10Entry) {
    const full = `${d.c} — ${d.d}`;
    setQuery(full);
    onChange(full);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <input
        id={id}
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => query.trim() && results.length && setOpen(true)}
        placeholder={placeholder || "Busca por nombre o código CIE-10…"}
        className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition bg-[var(--bg)] border-[var(--brd)]"
      />
      {open && (
        <div className="sug">
          {results.map((d) => (
            <div key={d.c} className="si" onMouseDown={() => select(d)}>
              <span className="sin">{d.c} — {d.d}</span>
              <span className="sis">{d.s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
