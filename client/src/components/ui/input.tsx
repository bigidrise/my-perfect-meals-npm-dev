import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "autofill:bg-black/40 autofill:text-white autofill:shadow-[inset_0_0_0px_1000px_rgba(0,0,0,0.4)]",
          "[&:-webkit-autofill]:bg-black/40 [&:-webkit-autofill]:text-white [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_rgba(0,0,0,0.4)] [&:-webkit-autofill]:[-webkit-text-fill-color:white]",
          "[&:-webkit-autofill:hover]:shadow-[inset_0_0_0px_1000px_rgba(0,0,0,0.4)] [&:-webkit-autofill:focus]:shadow-[inset_0_0_0px_1000px_rgba(0,0,0,0.4)]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
