import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware() {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ token }) {
        return token != null
      },
    },
  }
)

export const config = {
  matcher: [
    '/admin/:path*',
    '/learn/:path*',
    '/api/((?!auth).)*',
  ],
}
