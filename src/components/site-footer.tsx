import type { ReactNode } from "react";
import { GitHubIcon, LinkedInIcon, XIcon } from "@/components/brand-icons";

interface SocialLink {
  label: string;
  href: string;
  icon: ReactNode;
}

const links: SocialLink[] = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/inegro/",
    icon: <LinkedInIcon className="size-[18px]" />,
  },
  {
    label: "X",
    href: "https://x.com/nachonnc",
    icon: <XIcon className="size-[18px]" />,
  },
  {
    label: "GitHub",
    href: "https://github.com/nacho9900",
    icon: <GitHubIcon className="size-[18px]" />,
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-5">
        <p className="text-xs text-muted-foreground">
          Built by Nacho Negro Caino
        </p>
        <nav className="flex items-center gap-1">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={link.label}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.icon}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
