import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * A drop-in replacement for classnames + tailwind-merge.
 * Usage: cn("p-2", isActive && "bg-blue-500")
 */
export function cn(...classes: Parameters<typeof clsx>) {
  return twMerge(clsx(...classes));
}
