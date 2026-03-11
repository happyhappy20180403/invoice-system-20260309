import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth API routes and static assets
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  // Check for session token (set by next-auth)
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value;

  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    if (sessionToken) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (!sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // /admin/* はadminロールのみ許可
  // ロール情報はセッションJWTに含まれているが、middlewareでJWT解析は
  // next-auth の auth() が Edge非対応のため cookie の存在チェックのみ行い、
  // ページ側で auth() を使って詳細チェックを行う設計とする。
  // ただし、/admin/* へのアクセス制御のためにカスタムヘッダーを活用する。

  // /api/xero/* は staff ロールからは利用不可 (プレビューまで)
  // 実際のロールチェックは API Route ハンドラ側で auth() を使って行う。
  // ここでは未認証のみブロックする（上記の sessionToken チェックで対応済み）。

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
