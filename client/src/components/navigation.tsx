import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme-provider";
import { useSound } from "@/lib/sound-provider";
import { Sun, Moon, Gamepad2, Home, Info, Volume2, VolumeX } from "lucide-react";
import { motion } from "framer-motion";

export function Navigation() {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { soundEnabled, toggleSound } = useSound();

  const navLinks = [
    { href: "/", label: "Home", icon: Home },
    { href: "/about", label: "About", icon: Info },
  ];

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md"
    >
      <nav className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link href="/">
          <div
            className="flex items-center gap-2 cursor-pointer hover-elevate rounded-md px-2 py-1"
            data-testid="link-home-logo"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">WordPlay</span>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = location === link.href;
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="gap-2"
                  data-testid={`link-nav-${link.label.toLowerCase()}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{link.label}</span>
                </Button>
              </Link>
            );
          })}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSound}
            data-testid="button-sound-toggle"
          >
            {soundEnabled ? (
              <Volume2 className="h-5 w-5" />
            ) : (
              <VolumeX className="h-5 w-5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>
        </div>
      </nav>
    </motion.header>
  );
}
