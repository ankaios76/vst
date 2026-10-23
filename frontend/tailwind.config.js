/** @type {import('tailwindcss').Config} */

/* Farbwerte stammen ausschließlich aus dem Plusnet CD (Dezember 2025).
   Die Zwischenstufen sind berechnet: helle Stufen durch Weiß-Beimischung,
   dunkle durch Onyx-Beimischung. Die im CD festgelegten Werte
   (Onyx 5/10/40, die Primär-, Sekundär- und Tertiärfarben) stehen
   unverändert an ihrer Stelle.

   Neutrale Töne laufen bewusst weiter unter dem Namen `gray`, damit die
   rund 2800 bestehenden neutralen Utility-Klassen ohne Umschreiben auf
   die Onyx-Stufen fallen. Alles, was das CD ausdrücklich regelt
   (Primäraktion, Links, Status), wird über die semantischen Namen
   weiter unten angesprochen. Siehe BRANDING.md, Variante C. */

const onyx = {
  50: '#F3F3F4', 100: '#E8E9EA', 200: '#D0D2D4', 300: '#B8BCBE', 400: '#A1A5A9',
  500: '#7E8389', 600: '#5A6268', 700: '#434B53', 800: '#2C343E', 900: '#141E28',
}
const bordeaux = {
  50: '#F7ECF1', 100: '#EED9E2', 200: '#DDB4C5', 300: '#C6809E', 400: '#AD4873',
  500: '#96144B', 600: '#861547', 700: '#791643', 800: '#65183E', 900: '#4E1A38',
}
const petrol = {
  50: '#EBF5F7', 100: '#D6ECEE', 200: '#ADD9DD', 300: '#75BEC6', 400: '#38A1AD',
  500: '#008796', 600: '#027A89', 700: '#04707E', 800: '#085F6C', 900: '#0B4D5A',
}
const tuerkis = {
  50: '#F3FCFD', 100: '#E8F8FA', 200: '#D1F2F5', 300: '#B1E9EE', 400: '#8EDFE7',
  500: '#6ED6E0', 600: '#63C0CA', 700: '#5AAEB8', 800: '#4C909A', 900: '#3C717B',
}
const gruen = {
  50: '#F3F9F4', 100: '#E7F2E9', 200: '#D0E5D4', 300: '#AFD4B6', 400: '#8CC196',
  500: '#6BAF78', 600: '#619E6E', 700: '#588F66', 800: '#4A785A', 900: '#3B5F4C',
}
const rot = {
  50: '#FDF3F1', 100: '#FBE6E4', 200: '#F7CDC9', 300: '#F2ABA3', 400: '#EC867A',
  500: '#E66455', 600: '#CD5C50', 700: '#B8554B', 800: '#964944', 900: '#723E3C',
}
const gelb = {
  50: '#FFFBF5', 100: '#FFF6EB', 200: '#FFEDD7', 300: '#FFE1BC', 400: '#FFD49E',
  500: '#FFC882', 600: '#E3B477', 700: '#CBA36E', 800: '#A68760', 900: '#7E6A50',
}
const lila = {
  50: '#F5F1FA', 100: '#EAE4F5', 200: '#D5C9EC', 300: '#B9A3DF', 400: '#9A7AD0',
  500: '#7D55C3', 600: '#704EB0', 700: '#6649A1', 800: '#554088', 900: '#43376E',
}

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* CD-Paletten unter ihren eigenen Namen */
        bordeaux, petrol, tuerkis, gruen, rot, gelb, lila,
        onyx,
        eisblau: '#DBF7FF',

        /* Neutrale Töne der bestehenden Oberfläche auf Onyx umbiegen */
        gray: onyx,
        slate: onyx,
        zinc: onyx,
        neutral: onyx,
        stone: onyx,

        /* Bestehende Akzentklassen fangen, falls eine Stelle übersehen wird.
           Ziel bleibt, diese durch die semantischen Namen zu ersetzen. */
        blue: petrol,
        sky: petrol,
        cyan: tuerkis,
        teal: petrol,
        indigo: lila,
        violet: lila,
        purple: lila,
        green: gruen,
        emerald: gruen,
        red: rot,
        rose: rot,
        orange: gelb,
        amber: gelb,
        yellow: gelb,

        /* primary war ein Himmelblau — jetzt die Hausfarbe */
        primary: bordeaux,

        /* Semantische Namen, an die CSS-Variablen gebunden */
        surface: 'var(--color-surface)',
        'surface-subtle': 'var(--color-surface-subtle)',
        'surface-accent': 'var(--color-surface-accent)',
        'surface-hover': 'var(--color-surface-hover)',
        content: 'var(--color-text)',
        muted: 'var(--color-text-muted)',
        'on-primary': 'var(--color-text-on-primary)',
        brand: 'var(--color-primary)',
        'brand-hover': 'var(--color-primary-hover)',
        accent: 'var(--color-accent)',
        link: 'var(--color-link)',
        'link-hover': 'var(--color-link-hover)',
        subtle: 'var(--color-border)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',
      },
      /* Statusfarben und Links haben zwei Lagen: die Reinfarbe traegt
         Punkte, Flaechen und Raender, die abgedunkelte Variante traegt
         Schrift. Getrennt ueber textColor, damit die rund 120 bestehenden
         text-success/-warning/-danger im Markup unveraendert bleiben und
         trotzdem AA erreichen. Werte und Begruendung in tokens.css. */
      textColor: {
        link: 'var(--color-link)',
        'link-hover': 'var(--color-link-hover)',
        success: 'var(--color-success-text)',
        warning: 'var(--color-warning-text)',
        danger: 'var(--color-danger-text)',
        info: 'var(--color-info-text)',
      },
      borderRadius: {
        icon: 'var(--radius-icon)',
        card: 'var(--radius-card)',
        input: 'var(--radius-input)',
      },
      fontFamily: {
        sans: ['var(--font-body)'],
        headline: ['var(--font-headline)'],
        body: ['var(--font-body)'],
      },
    },
  },
  plugins: [],
}
