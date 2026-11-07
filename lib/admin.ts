import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AdminProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
};

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getAdminProfile = cache(async (): Promise<AdminProfile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, is_superadmin")
    .eq("id", user.id)
    .maybeSingle();

  return (data as AdminProfile | null) ?? null;
});

/**
 * The gate for every admin page and action.
 *
 * Two distinct outcomes on purpose: no session goes to /login, while a signed-in
 * non-admin goes to /denied. Sending the second case to /login would loop - they
 * are already authenticated, so logging in again changes nothing.
 *
 * Call this in every page AND every server action. proxy.ts only checks for a
 * session; it deliberately does not query the database on each request, so the
 * superadmin check belongs here, next to the data.
 */
export async function requireSuperadmin(): Promise<AdminProfile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getAdminProfile();
  if (!profile?.is_superadmin) redirect("/denied");

  return profile;
}
