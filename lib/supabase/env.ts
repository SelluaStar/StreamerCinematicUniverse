import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_PUBLIC_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL. See docs/SUPABASE_SETUP.md.");
  return url;
}

export function getSupabasePublishableKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or SUPABASE_PUBLIC_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY). See docs/SUPABASE_SETUP.md.",
    );
  }
  return key;
}

export function getSupabaseSecretKey() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Missing SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY). See docs/SUPABASE_SETUP.md.");
  }
  return key;
}

export function assertPublicSupabaseEnv() {
  const parsed = publicSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Invalid Supabase public env. See docs/SUPABASE_SETUP.md.");
  }
  getSupabaseUrl();
  getSupabasePublishableKey();
}
