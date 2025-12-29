
import React, { InputHTMLAttributes, ReactNode } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Card
export const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("bg-surface border border-border rounded-lg p-4", className)} {...props}>
    {children}
  </div>
);

// Input
export const Input = React.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={cn(
          "flex h-9 w-full rounded-md border border-white/10 bg-[#191919] px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

// Textarea
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-white/10 bg-[#191919] px-3 py-2 text-sm shadow-sm placeholder:text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

// Button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: "bg-white text-black hover:bg-neutral-200",
      secondary: "bg-surface text-white border border-border hover:bg-neutral-800",
      ghost: "hover:bg-surface text-neutral-300 hover:text-white",
      outline: "border border-border bg-transparent hover:bg-surface text-neutral-300",
    };
    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-9 px-4 py-2",
      icon: "h-9 w-9 flex items-center justify-center",
    };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// Label
export const Label = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <label className={cn("text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-neutral-400 mb-2 block", className)}>
    {children}
  </label>
);

// Select (Wrapper around native for simplicity in this environment)
export const SelectNative = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
    ({ className, children, ...props }, ref) => {
      return (
        <div className="relative">
            <select
            className={cn(
                "flex h-9 w-full items-center justify-between rounded-md text-white bg-[#191919] px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 appearance-none",
                className
            )}
            ref={ref}
            {...props}
            >
            {children}
            </select>
             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-500">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
        </div>
      );
    }
  );
  SelectNative.displayName = "SelectNative";

// Badge
export const Badge = ({ children, variant = 'default', className }: { children?: ReactNode, variant?: 'default' | 'success' | 'warning', className?: string }) => {
    const styles = {
        default: "bg-neutral-800 text-neutral-300",
        success: "bg-green-900/30 text-green-400 border border-green-900",
        warning: "bg-yellow-900/30 text-yellow-400 border border-yellow-900"
    }
    return (
        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors", styles[variant], className)}>
            {children}
        </span>
    )
}

// Skeleton
export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse rounded-md bg-neutral-800/50", className)} />
);

// Progress
export const Progress = ({ value, max = 100, className }: { value: number; max?: number; className?: string }) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <div className={cn("h-2 w-full overflow-hidden rounded-full bg-neutral-800", className)}>
            <div 
                className="h-full bg-white transition-all duration-500 ease-in-out" 
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
}
