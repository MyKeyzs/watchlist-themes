// src/lib/env.ts
export const MASSIVE_API_KEY: string =
  (import.meta as any).env?.VITE_MASSIVE_API_KEY ??
  (window as any).__MASSIVE_API_KEY__ ?? // optional dev override
  "";