import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));

  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/explore") ||
    pathname.startsWith("/gear") ||
    pathname.startsWith("/rentals") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/account/login") ||
    pathname.startsWith("/account/signup") ||
    pathname.startsWith("/account/reset-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth");

  // Skip remote auth round-trip on public routes or when no session cookie exists
  if (!hasAuthCookie || isPublicRoute) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Calling getUser refreshes the session if expired and syncs cookies
  await supabase.auth.getUser();

  return supabaseResponse;
}
