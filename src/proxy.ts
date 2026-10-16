import { NextResponse, type NextRequest } from "next/server";

// Staff pages need a login. This only checks the session cookie exists (fast, no database);
// every API route still verifies the session itself, so a fake cookie gets nothing.
export function proxy(request: NextRequest) {
  const loggedIn = request.cookies.has("sl_session");
  const { pathname } = request.nextUrl;

  // The homepage is public; staff who are logged in go straight to their dashboard.
  if (pathname === "/") return loggedIn ? NextResponse.redirect(new URL("/dashboard", request.url)) : NextResponse.next();

  if (loggedIn) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/stock/:path*", "/bundles/:path*", "/insights/:path*", "/poster/:path*", "/settings/:path*"],
};
