import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");

  const defaultNext = type === "recovery" ? "/account/reset-password" : "/account";
  const next = nextParam || defaultNext;

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.nextUrl.origin));
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.nextUrl.origin));
    }
  }

  // If verification failed or code is expired, redirect to fallback with appropriate destination
  const fallbackPath = type === "recovery" ? "/account/reset-password" : "/account/login";
  return NextResponse.redirect(new URL(fallbackPath, request.nextUrl.origin));
}
