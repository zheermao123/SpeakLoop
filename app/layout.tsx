import type { Metadata } from "next"
import ExeTitlebar from "@/components/ExeTitlebar"
import KonstaApp from "@/components/KonstaApp"
import "./globals.css"

export const metadata: Metadata = { title: "SpeakLoop" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <KonstaApp>
          <ExeTitlebar />
          <main className="container">{children}</main>
        </KonstaApp>
      </body>
    </html>
  )
}
