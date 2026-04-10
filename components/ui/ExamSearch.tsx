"use client";

import { useState, useRef, useEffect } from "react";
import { examDB } from "@/lib/data/examenes";

interface Props {
  onSelect: (name: string) => void;
  placeholder?: string;
}

export default function ExamSearch({ onSelect, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<typeof examDB>([]);
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
    const matched = examDB.filter((x) => x.n.toLowerCase().includes(t)).slice(0, 50);
    setResults(matched);
    setOpen(matched.length > 0);
  }

  function select(name: string) {
    onSelect(name);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        placeholder={placeholder || "Busca examen…"}
        className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition bg-[var(--bg)] border-[var(--brd)]"
      />
      {open && (
        <div className="sug">
          {results.map((x, i) => (
            <div key={i} className="si" onMouseDown={() => select(x.n)}>
              <span className="sin">{x.n}</span>
              <span className="sis">{x.t}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
