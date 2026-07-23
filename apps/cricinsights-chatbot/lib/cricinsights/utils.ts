import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function resolvePlayerPhoto(
  imagePath: string | null | undefined,
  name: string,
): string {
  if (imagePath && isTrustedPlayerImageUrl(imagePath)) {
    return imagePath;
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0b1c2c&color=7dd3fc&size=256`;
}

function isTrustedPlayerImageUrl(url: string): boolean {
  const normalized = url.trim().toLowerCase();
  if (!normalized.startsWith('https://')) return false;
  if (normalized.includes('placeholder') || normalized.includes('example.com')) {
    return false;
  }
  return (
    normalized.includes('sportmonks.com') ||
    normalized.includes('ui-avatars.com')
  );
}

export function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object'
    ? { ...(input as Record<string, unknown>) }
    : {};
}

export function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

export function pickNumber(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))) {
      return Number(v);
    }
  }
  return undefined;
}

/** Strip common Markdown decorations from short labels (titles, chips, names). */
export function stripInlineMarkdown(text: string): string {
  if (!text) return text;
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .trim();
}
