import type { Metadata } from "next"
import Link from "next/link"
import "./globals.css"

export const metadata: Metadata = { title: "SpeakLoop" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <nav className="nav">
          <Link href="/">SpeakLoop</Link>
          <Link href="/scenarios">场景</Link>
          <Link href="/vocab">生词本</Link>
        </nav>
        <main className="container">{children}</main>
      </body>
    </html>
  )
}
