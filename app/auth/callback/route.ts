import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth landing route. Supabase redirects here with a `code` which is
 * exchanged for a session cookie. The superadmin check happens afterwards,
 * per page - signing in is not the same as being allowed in.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Behind Vercel's proxy the request origin can be an internal host. The
  // forwarded host is only trusted when it names one of our own deployments:
  // the header is client-settable, and an unchecked value would redirect a
  // freshly authenticated admin to someone else's domain.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const isOwnHost =
    !!forwardedHost &&
    /^(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app)$/i.test(
      forwardedHost,
    );
  const base = isOwnHost ? `${forwardedProto}://${forwardedHost}` : origin;

  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent(providerError)}`,
    );
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent("No authorization code returned.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${base}/`);
}
