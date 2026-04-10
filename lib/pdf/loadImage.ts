import { createClient } from "@/lib/supabase/client";

async function urlToDataUrl(signedUrl: string): Promise<string | null> {
  try {
    const res = await fetch(signedUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function extractPath(bucket: string, fullUrl: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = fullUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(fullUrl.slice(idx + marker.length).split("?")[0]);
}

async function fetchStorageAsDataUrl(bucket: string, url: string): Promise<string | null> {
  const supabase = createClient();
  const path = extractPath(bucket, url);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) return null;
  return urlToDataUrl(data.signedUrl);
}

export async function loadProfileImages(
  firmaUrl: string | null,
  logoUrl: string | null,
): Promise<{ firmaDataUrl: string | null; logoDataUrl: string | null }> {
  const [firmaDataUrl, logoDataUrl] = await Promise.all([
    firmaUrl ? fetchStorageAsDataUrl("firmas", firmaUrl) : Promise.resolve(null),
    logoUrl ? fetchStorageAsDataUrl("logos", logoUrl) : Promise.resolve(null),
  ]);
  return { firmaDataUrl, logoDataUrl };
}
