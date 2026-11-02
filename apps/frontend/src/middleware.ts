// apps/frontend/src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )
   const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // Public routes that don't require auth
  const isAuthPage = pathname.startsWith('/auth')
  const isLegalPage = pathname.startsWith('/legal')
  const isPublicPage = isAuthPage || isLegalPage

  // If logged in and on an auth page → go to home
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // If not logged in and trying to access a protected page → go to login
  if (!session && !isPublicPage) {
    const redirectUrl = new URL('/auth/login', request.url)
    // Preserve any Set-Cookie headers Supabase added to `response`
    const redirect = NextResponse.redirect(redirectUrl)
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}