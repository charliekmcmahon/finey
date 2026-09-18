import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/connections", label: "Connections" },
  { href: "/sync", label: "Sync history" },
];

export function Nav() {
  return (
    <nav className="border-b">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          Finey
        </Link>
        <div className="flex gap-4 text-sm text-muted-foreground">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
