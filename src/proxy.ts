import { NextResponse, type NextRequest } from "next/server";

// Staff pages need a login. This only checks the session cookie exists (fast, no database);
// every API route still verifies the session itself, so a fake cookie gets nothing.
export function proxy(request: NextRequest) {
  if (request.cookies.has("sl_session")) return NextResponse.next();
  const login = new URL("/login", request.url);
  if (request.nextUrl.pathname !== "/") login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/", "/stock/:path*", "/bundles/:path*", "/insights/:path*", "/poster/:path*", "/settings/:path*"],
};
