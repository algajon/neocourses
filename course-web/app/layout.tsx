import type { ReactNode } from 'react'
import { Providers } from './providers'
import { ToastProvider } from '@/components/Toast/ToastProvider'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import './globals.css'

export const metadata = {
  title: 'courseneo',
  description: 'Structured learning for modern teams',
}

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  // Set the persisted theme before paint to avoid a flash.
  const themeScript = `(function(){try{var t=localStorage.getItem('courseneo-theme');document.documentElement.setAttribute('data-theme',t==='white'||t==='dark'?t:'dark');}catch(e){}})();`
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  )
}
