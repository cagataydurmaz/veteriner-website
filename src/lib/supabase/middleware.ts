import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip middleware if Supabase is not configured yet
  if (!supabaseUrl?.startsWith('http') || !supabaseAnonKey || supabaseAnonKey === 'your_supabase_anon_key') {
    return NextResponse.next({ request });
  }

  // ── CSRF Protection ─────────────────────────────────────────────────────────
  // For state-changing API requests, verify the Origin header matches this host.
  // Browsers always send Origin on cross-origin requests; we reject anything
  // that doesn't originate from our own app. Webhooks (iyzico callbacks, etc.)
  // should use dedicated public routes that are explicitly excluded here.
  const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  const pathname = request.nextUrl.pathname;
  if (MUTATING_METHODS.has(request.method) && pathname.startsWith('/api/')) {
    // Public webhook/callback paths that are legitimately called from third parties
    const CSRF_EXEMPT = [
      '/api/auth/callback',       // Supabase OAuth callback (GET but listed for safety)
      '/api/auth/confirm',        // Email confirmation redirect
      '/api/iyzico/webhook',      // Iyzico payment webhook (external POST)
      '/api/iyzico/callback',     // Iyzico 3DS callback (external POST)
    ];
    const isExempt = CSRF_EXEMPT.some(p => pathname.startsWith(p));
    if (!isExempt) {
      const origin = request.headers.get('origin');
      const host = request.headers.get('host') || request.nextUrl.host;
      // Allow requests with no Origin (server-to-server / same-origin fetch)
      // but reject cross-origin requests from a different host.
      if (origin) {
        let originHost: string;
        try {
          originHost = new URL(origin).host;
        } catch {
          originHost = '';
        }
        if (originHost && originHost !== host) {
          return new NextResponse(JSON.stringify({ error: 'CSRF hatası: geçersiz istek kaynağı' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }
  }
  // ────────────────────────────────────────────────────────────────────────────

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  // Note: pathname is already declared at the top of this function for CSRF checks

  // Public routes
  const publicRoutes = ['/', '/auth', '/auth/login', '/auth/register', '/auth/otp', '/auth/vet-register', '/auth/vet-login', '/hesap-askiya-alindi'];
  const isPublicRoute = publicRoutes.some(r => pathname === r || pathname.startsWith('/auth') || pathname.startsWith('/hesap-askiya-alindi'))
    || pathname.startsWith('/api/')
    || pathname.startsWith('/blog')
    || pathname.startsWith('/veteriner')
    || pathname.startsWith('/veteriner-sehir')
    || pathname.startsWith('/arac')
    || pathname.startsWith('/kvkk')
    || pathname.startsWith('/kullanim-kosullari')
    || pathname.startsWith('/hakkimizda')
    || pathname.match(/^\/[a-z0-9-]+-veteriner/) !== null;

  if (!user && !isPublicRoute) {
    url.pathname = (pathname.startsWith('/vet/') || pathname === '/vet') ? '/auth/vet-login' : '/auth/login';
    return NextResponse.redirect(url);
  }

  if (user) {
    // Routes like /veteriner-bul, /veterinerler, /veteriner/:slug are PUBLIC
    // and must NOT be treated as the /vet panel.
    const isVetPanel = pathname.startsWith('/vet/') || pathname === '/vet';
    const isOwnerOrVetRoute = pathname.startsWith('/owner') || isVetPanel;
    const isAdminRoute = pathname.startsWith('/admin');
    const isAuthRoute = pathname.startsWith('/auth') && !pathname.includes('logout');

    // For owner/vet routes: fetch role + account_status from users in one query
    // For vet routes: also need veterinarians account_status — fetch in parallel
    // For auth/admin routes: only need role
    let role: string | undefined;
    let accountStatus: string | null = null;
    let suspendedUntil: string | null = null;
    let suspensionReason: string | null = null;
    let vetStatusData: { is_verified?: boolean; rejection_reason?: string | null; account_status?: string | null; suspended_until?: string | null; suspension_reason?: string | null } | null = null;

    if (isOwnerOrVetRoute) {
      // Fetch user role+status AND (for vet routes) veterinarian status in parallel
      const [{ data: userData }, { data: fetchedVetStatusData }] = await Promise.all([
        supabase
          .from('users')
          .select('role, account_status, suspended_until, suspension_reason')
          .eq('id', user.id)
          .maybeSingle(),
        // Only fetch vet status if this might be a vet route (saves a query for owners)
        isVetPanel
          ? supabase
              .from('veterinarians')
              .select('account_status, suspended_until, suspension_reason, is_verified, rejection_reason')
              .eq('user_id', user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      vetStatusData = fetchedVetStatusData ?? null;
      role = userData?.role;

      // For owners: status is in users table; for vets: status is in veterinarians table
      if (role === 'owner') {
        accountStatus = userData?.account_status ?? null;
        suspendedUntil = userData?.suspended_until ?? null;
        suspensionReason = userData?.suspension_reason ?? null;
      } else if (role === 'vet' && vetStatusData) {
        accountStatus = vetStatusData.account_status ?? null;
        suspendedUntil = vetStatusData.suspended_until ?? null;
        suspensionReason = vetStatusData.suspension_reason ?? null;
      }
    } else {
      // Auth redirect check or admin — only need role
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      role = userData?.role;
    }

    // Redirect authenticated users away from auth pages
    // Exception: reset-password must always be accessible (user needs to set new password)
    const isResetPassword = pathname === '/auth/reset-password';
    if (isAuthRoute && !isResetPassword) {
      if (role === 'owner') {
        url.pathname = '/owner/dashboard';
      } else if (role === 'vet') {
        url.pathname = '/vet/dashboard';
      } else if (role === 'admin') {
        url.pathname = '/admin/dashboard';
      }
      if (role) return NextResponse.redirect(url);
    }

    // Role-based access control — her rol sadece kendi paneline erişebilir
    if (pathname.startsWith('/owner') && role !== 'owner') {
      if (role === 'vet')        { url.pathname = '/vet/dashboard';   url.searchParams.set('wrong_panel', 'owner'); }
      else if (role === 'admin') { url.pathname = '/admin/dashboard'; url.searchParams.set('wrong_panel', 'owner'); }
      else                         url.pathname = '/auth/login';
      return NextResponse.redirect(url);
    }
    if (isVetPanel && role !== 'vet') {
      if (role === 'owner')      { url.pathname = '/owner/dashboard'; url.searchParams.set('wrong_panel', 'vet'); }
      else if (role === 'admin') { url.pathname = '/admin/dashboard'; url.searchParams.set('wrong_panel', 'vet'); }
      else                         url.pathname = '/auth/login';
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith('/admin') && role !== 'admin') {
      if (role === 'vet')        { url.pathname = '/vet/dashboard';   url.searchParams.set('wrong_panel', 'admin'); }
      else if (role === 'owner') { url.pathname = '/owner/dashboard'; url.searchParams.set('wrong_panel', 'admin'); }
      else                         url.pathname = '/auth/login';
      return NextResponse.redirect(url);
    }

    // Unverified vet: redirect to pending-approval page for all vet routes
    // except profile, settings, and pending-approval itself.
    // Applies both to pending (not yet reviewed) AND rejected vets.
    if (isVetPanel && role === 'vet' && vetStatusData) {
      const isVerified = vetStatusData.is_verified;
      const UNVERIFIED_ALLOWED = ['/vet/profile', '/vet/pending-approval', '/vet/settings'];
      const onAllowedPage = UNVERIFIED_ALLOWED.some(p => pathname.startsWith(p));
      if (!isVerified && !onAllowedPage) {
        url.pathname = '/vet/pending-approval';
        return NextResponse.redirect(url);
      }
    }

    // Account status check for owner and vet routes only (not admin)
    if (isOwnerOrVetRoute && role !== 'admin') {
      if (accountStatus === 'deleted') {
        await supabase.auth.signOut();
        url.pathname = isVetPanel ? '/auth/vet-login' : '/auth/login';
        return NextResponse.redirect(url);
      }

      if (accountStatus === 'banned') {
        // Sign out and redirect to banned page
        await supabase.auth.signOut();
        url.pathname = '/auth/banned';
        return NextResponse.redirect(url);
      }

      if (accountStatus === 'suspended' && suspendedUntil && new Date(suspendedUntil) > new Date()) {
        // Allow through but set suspension banner cookie
        supabaseResponse.cookies.set(
          'show_suspension_banner',
          encodeURIComponent(JSON.stringify({ until: suspendedUntil, reason: suspensionReason ?? '' })),
          { path: '/', httpOnly: false, sameSite: 'lax' }
        );
        supabaseResponse.cookies.delete('show_review_banner');
      } else if (accountStatus === 'under_review') {
        // Allow through but set review banner cookie
        supabaseResponse.cookies.set(
          'show_review_banner',
          'true',
          { path: '/', httpOnly: false, sameSite: 'lax' }
        );
        supabaseResponse.cookies.delete('show_suspension_banner');
      } else {
        // Active or suspension expired — clear banner cookies
        supabaseResponse.cookies.delete('show_suspension_banner');
        supabaseResponse.cookies.delete('show_review_banner');
      }
    }
  }

  return supabaseResponse;
}
