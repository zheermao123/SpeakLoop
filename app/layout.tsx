import type { Metadata } from "next"
import ExeTitlebar from "@/components/ExeTitlebar"
import Heartbeat from "@/components/Heartbeat"
import KonstaApp from "@/components/KonstaApp"
import "./globals.css"

export const metadata: Metadata = { title: "SpeakLoop" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <KonstaApp>
          <Heartbeat />
          <ExeTitlebar />
          <main className="container">{children}</main>
        </KonstaApp>
      </body>
    </html>
  )
}
