import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Cloudflare's Managed Challenge / Turnstile submits a POST request to the original URL
  // after the user completes the CAPTCHA.
  // Next.js static pages only accept GET requests and will throw a 405 Method Not Allowed.
  // To fix this, we intercept POST requests to the main page and redirect them back as a GET.
  if (request.method === 'POST') {
    return NextResponse.redirect(new URL(request.url), 302);
  }
  
  return NextResponse.next();
}

export const config = {
  // Hanya jalankan middleware ini di halaman utama (bukan di API atau aset statis)
  matcher: '/',
};
