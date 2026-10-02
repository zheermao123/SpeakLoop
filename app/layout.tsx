import type { Metadata } from "next"
import Heartbeat from "@/components/Heartbeat"
import Nav from "@/components/Nav"
import "./globals.css"

export const metadata: Metadata = { title: "SpeakLoop" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <Heartbeat />
        <Nav />
        <main className="container">{children}</main>
      </body>
    </html>
  )
}
