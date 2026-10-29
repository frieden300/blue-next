import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
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

  // Skip remote auth round-trip on public routes or when no session cookie exists (< 20ms response)
  if (!hasAuthCookie || isPublicRoute) {
    return NextResponse.next({ request });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static Next.js bundle files)
     * - _next/image (Next.js image optimization)
     * - favicon.ico (favicon)
     * - assets (cinematic scrollytelling videos, audio, images, script)
     * - static media files by extension
     */
    "/((?!_next/static|_next/image|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|mp3|wav|ogg)$).*)",
  ],
};
