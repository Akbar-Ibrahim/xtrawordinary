import { Link } from "wouter";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-background/80 mt-16" data-testid="site-footer">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors" data-testid="link-footer-logo">
            <div className="flex h-6 w-6 items-center justify-center rounded-md overflow-hidden bg-primary">
              <img src="/favicon.png" alt="xtraWordinary logo" className="h-6 w-6 object-cover" />
            </div>
            <span className="font-semibold text-foreground">xtraWordinary</span>
          </div>
        </Link>

        <p className="text-xs">© {year} xtraWordinary. All rights reserved.</p>

        <nav className="flex items-center gap-4">
          <Link href="/about">
            <span className="hover:text-foreground transition-colors cursor-pointer" data-testid="link-footer-about">
              About
            </span>
          </Link>
        </nav>
      </div>
    </footer>
  );
}
