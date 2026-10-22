import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }
    mql.addEventListener("change", onChange)
    // Archivo generado por el CLI de shadcn: no se reescribe a mano. Este setState en
    // el efecto es la forma SSR-safe de resolver el media query en el primer montaje
    // (window no existe durante el render del servidor).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(window.innerWidth < breakpoint)
    return () => mql.removeEventListener("change", onChange)
  }, [breakpoint])

  return !!isMobile
}
