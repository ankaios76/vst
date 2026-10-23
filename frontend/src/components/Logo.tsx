/* Logo der Anwendung: Wortmarke mit Welle, einmal in der Hausfarbe (Hellmodus)
   und einmal in Weiß (Dunkelmodus). Dateien unter public/brand/vst-logo-*.svg.

   Warum kein <picture>: die App steuert das Theme über eine .dark-Klasse auf
   <html> (ThemeContext, mit localStorage), nicht über die Systemeinstellung.
   Ein <source media="(prefers-color-scheme: dark)"> würde den Umschalter im
   Header ignorieren, daher zwei <img> und CSS-Klassen. */

/** Wortmarke, optional mit Subline. Hausfarbe im Hellmodus, Weiß im
 *  Dunkelmodus — die Hausfarbe auf dunklem Grund hätte zu wenig Kontrast. */
export function Logo({
  withClaim = false,
  className = 'h-8 w-auto',
}: {
  withClaim?: boolean
  className?: string
}) {
  const suffix = withClaim ? 'claim-' : ''
  return (
    <>
      <img
        src={`/brand/vst-logo-${suffix}primary.svg`}
        alt="VST"
        className={`${className} dark:hidden`}
      />
      <img
        src={`/brand/vst-logo-${suffix}white.svg`}
        alt="VST"
        className={`${className} hidden dark:block`}
      />
    </>
  )
}
