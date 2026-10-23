/* Logo der Anwendung — Regeln in tools/brand/LOGO.md.

   Achtung: die Code-Beispiele in LOGO.md nennen noch die Dateinamen des
   vorigen Logosets (amtsleitung-*). Maßgeblich sind die tatsächlich
   vorhandenen Dateien unter public/brand/, also vst-*.

   Warum kein <picture>: LOGO.md schlägt für die Hell/Dunkel-Umschaltung
   <source media="(prefers-color-scheme: dark)"> vor, und für die Bildmarke
   einen [data-theme="dark"]-Selektor. Beides greift hier nicht — diese App
   steuert das Theme über eine .dark-Klasse auf <html> (ThemeContext, mit
   localStorage), nicht über die Systemeinstellung und nicht über ein
   Attribut. <picture> würde den Umschalter im Header ignorieren. LOGO.md
   nennt den Fall selbst und verweist auf die CSS-display-Lösung.

   Schutzraum: umlaufend die Höhe eines Kleinbuchstabens. Bei 32 px
   Logohöhe sind das rund 18 px; die Aufrufstellen halten das über den
   Abstand zur Navigation ein. */

/** Wortmarke, optional mit Subline. Bordeaux im Hellmodus, Weiß im
 *  Dunkelmodus — Bordeaux auf Onyx erreicht nur 2,0:1. */
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
        src={`/brand/vst-logo-${suffix}bordeaux.svg`}
        alt="VST"
        className={`${className} dark:hidden`}
      />
      <img
        src={`/brand/vst-logo-${suffix}weiss.svg`}
        alt="VST"
        className={`${className} hidden dark:block`}
      />
    </>
  )
}
