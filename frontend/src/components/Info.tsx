import React from "react";
import { Info as InfoIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { VisuallyHidden } from "./ui/visually-hidden";
import { About } from "./About";

interface InfoProps {
    /** true renders the compact rail button (collapsed sidebar) */
    isCollapsed?: boolean;
    /** "icon" renders a compact 9x9 icon button for the sidebar footer action row */
    variant?: 'full' | 'icon';
}

const Info = React.forwardRef<HTMLButtonElement, InfoProps>(({ isCollapsed, variant = 'full' }, ref) => {
  const isIconVariant = variant === 'icon';
  return (
    <Dialog aria-describedby={undefined}>
      <DialogTrigger asChild>
        <button
          ref={ref}
          className={`flex items-center justify-center cursor-pointer border-none transition-colors ${
            isIconVariant
              ? "h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              : isCollapsed
                ? "bg-transparent p-2 hover:bg-muted rounded-lg"
                : "w-full px-3 py-1.5 mt-1 text-sm font-medium text-foreground/80 bg-muted hover:bg-muted rounded-lg shadow-sm"
          }`}
          title="About Meetily"
        >
          <InfoIcon className={`text-muted-foreground ${isCollapsed && !isIconVariant ? "w-5 h-5" : "w-4 h-4"}`} />
          {!isCollapsed && !isIconVariant && (
            <span className="ml-2 text-sm text-foreground/80">About</span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent>
        <VisuallyHidden>
          <DialogTitle>About Meetily</DialogTitle>
        </VisuallyHidden>
        <About />
      </DialogContent>
    </Dialog>
  );
});

Info.displayName = "About";

export default Info; 