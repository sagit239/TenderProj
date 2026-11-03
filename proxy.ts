import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session on every request and protects all pages
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;
  const isLoginPage = path === "/login";
  // Open without a session: password reset pages, and the reminders endpoint (checks its own secret)
  const isPublic =
    isLoginPage || path === "/forgot-password" || path === "/auth/confirm" || path.startsWith("/api/cron/");

  if (!isSignedIn && path === "/reset-password") {
    return redirectWithCookies(request, response, "/forgot-password", "?error=expired");
  }
  if (!isSignedIn && !isPublic) {
    return redirectWithCookies(request, response, "/login");
  }
  if (isSignedIn && isLoginPage) {
    return redirectWithCookies(request, response, "/tenders");
  }
  return response;
}

// Keeps refreshed auth cookies when redirecting
function redirectWithCookies(
  request: NextRequest,
  from: NextResponse,
  pathname: string,
  search = "",
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
