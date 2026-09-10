import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Não executar código entre createServerClient e getClaims(): fazer isso
  // pode causar logout aleatório de usuários (ver docs do Supabase). Se o
  // token estiver perto de expirar, getClaims() já renova a sessão antes de
  // validar, e a renovação é persistida via setAll acima.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isAuthRoute = pathname.startsWith("/auth");

  if (!isAuthenticated && !isPublicPath && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";

    const hadSessionCookie = request.cookies
      .getAll()
      .some((cookie) => cookie.name.startsWith("sb-"));
    if (hadSessionCookie) {
      url.searchParams.set("sessao", "expirada");
    }

    return NextResponse.redirect(url);
  }

  if (isAuthenticated && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
