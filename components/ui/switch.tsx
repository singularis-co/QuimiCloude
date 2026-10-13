"use client"

import type { ReactNode } from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { touchTarget } from "@/lib/shared/ui/touch-target"
import { cn } from "@/lib/utils"

type SwitchProps = SwitchPrimitive.Root.Props & {
  readonly children?: ReactNode
}

/**
 * Interruptor de encendido y apagado. Lo que va en `children` (icono, texto) se pinta dentro de
 * la raíz, a la derecha de la pista, para que todo el conjunto sea la zona que se pulsa.
 */
function Switch({ className, children, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        touchTarget,
        "group/switch inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg text-[13px] font-medium whitespace-nowrap text-foreground outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:min-h-9 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        children !== undefined && "px-2 hover:bg-muted data-disabled:hover:bg-transparent",
        className
      )}
      {...props}
    >
      <span
        data-slot="switch-track"
        aria-hidden="true"
        className="relative h-5 w-9 flex-none rounded-full bg-input transition-colors duration-200 group-data-checked/switch:bg-primary motion-reduce:transition-none"
      >
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          className="absolute top-0.5 left-0.5 size-4 rounded-full bg-card shadow-[0_1px_2px_rgb(0_0_0/0.3)] transition-transform duration-200 data-checked:translate-x-4 motion-reduce:transition-none"
        />
      </span>
      {children}
    </SwitchPrimitive.Root>
  )
}

export { Switch }
export type { SwitchProps }
