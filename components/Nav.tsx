"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export default function Nav() {
  const pathname = usePathname()
  const links = [
    { href: "/scenarios", label: "场景" },
    { href: "/vocab", label: "生词本" },
    { href: "/settings", label: "设置" },
  ]
  return (
    <nav className="nav" aria-label="主导航">
      <Link href="/">SpeakLoop</Link>
      {links.map(l => (
        <Link key={l.href} href={l.href} className={pathname.startsWith(l.href) ? "active" : ""}>
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
