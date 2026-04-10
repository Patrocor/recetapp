import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function usernameToEmail(username: string) {
  return `${username.toLowerCase().trim()}@recetapp.pe`;
}

export function newFolio() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rnd = Math.floor(Math.random() * 9000) + 1000;
  return `RX-${yy}${mm}${dd}-${rnd}`;
}

export function formatDateLong(isoDate: string): string {
  return new Date(isoDate + "T00:00:00").toLocaleDateString("es-PE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getExpDisplay(expAt: string | null): { label: string; cls: string } {
  if (!expAt) return { label: "Permanente", cls: "" };
  const diff = Math.ceil((new Date(expAt).getTime() - Date.now()) / 86400000);
  if (diff < 0) return { label: "Expirado", cls: "text-red-600" };
  if (diff <= 7) return { label: `${diff}d restantes`, cls: "text-amber-600" };
  return {
    label: new Date(expAt).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    cls: "",
  };
}

export function isValidAccess(ua: { active: boolean; exp_at: string | null }) {
  if (!ua.active) return false;
  if (ua.exp_at && new Date(ua.exp_at).getTime() < Date.now()) return false;
  return true;
}
