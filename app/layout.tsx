import type { Metadata } from "next"
import ExeTitlebar from "@/components/ExeTitlebar"
import KonstaApp from "@/components/KonstaApp"
import Nav from "@/components/Nav"
import "./globals.css"

export const metadata: Metadata = { title: "SpeakLoop" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <KonstaApp>
          <div className="app-shell">
            <ExeTitlebar />
            <div className="app-body">
              <Nav />
              <main className="content">{children}</main>
            </div>
          </div>
        </KonstaApp>
      </body>
    </html>
  )
}
