import React from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { VisuallyHidden } from "./ui/visually-hidden";
import { About } from "./About";

interface LogoProps {
  isCollapsed: boolean;
}

const Logo = React.forwardRef<HTMLButtonElement, LogoProps>(
  ({ isCollapsed }, ref) => {
    return (
      <Dialog aria-describedby={undefined}>
        {isCollapsed ? (
          <DialogTrigger asChild>
            <button
              ref={ref}
              type="button"
              title="Meetily — Fork by NickelBlvck"
              className="flex items-center justify-center mb-2 cursor-pointer bg-transparent border-none p-0 hover:opacity-80 transition-opacity"
              aria-label="About Meetily"
            >
              <Image
                src="/logo-collapsed.png"
                alt="Meetily"
                width={40}
                height={40}
                className="object-contain"
                priority
              />
            </button>
          </DialogTrigger>
        ) : (
          <DialogTrigger asChild>
            <button
              ref={ref}
              type="button"
              className="w-full border rounded-full bg-primary/10 border-white mb-2 block cursor-pointer hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="About Meetily"
            >
              <span
                className="block text-lg font-bold text-foreground/90 leading-tight"
                style={{ fontFamily: 'var(--font-logo), sans-serif' }}
              >
                Meetily
              </span>
              <span className="block text-[10px] text-muted-foreground leading-none pb-1.5">
                Fork by NickelBlvck
              </span>
            </button>
          </DialogTrigger>
        )}
        <DialogContent>
          <VisuallyHidden>
            <DialogTitle>About Meetily</DialogTitle>
          </VisuallyHidden>
          <About />
        </DialogContent>
      </Dialog>
    );
  },
);

Logo.displayName = "Logo";

export default Logo;
