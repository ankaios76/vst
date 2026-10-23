/** @type {import('tailwindcss').Config} */

/* Farbwerte der Oberfläche. Die Skalen sind einmal definiert; alles Weitere
   läuft über die semantischen Namen (brand, link, success, ...), die in
   src/tokens.css an CSS-Variablen hängen und dort auch den Dark Mode tragen.

   Neutrale Töne laufen bewusst weiter unter dem Namen `gray`, damit die
   bestehenden neutralen Utility-Klassen ohne Umschreiben auf die Ink-Stufen
   fallen. */

const ink = {
  50: '#F3F3F4', 100: '#E8E9EA', 200: '#D0D2D4', 300: '#B8BCBE', 400: '#A1A5A9',
  500: '#7E8389', 600: '#5A6268', 700: '#434B53', 800: '#2C343E', 900: '#141E28',
}
const brandBlue = {
  50: '#EDF3F8', 100: '#DAE8F1', 200: '#B6D1E3', 300: '#88B4D2', 400: '#5192BD', 500: '#1A6FA8', 600: '#1A6AA0', 700: '#196599', 800: '#195F8E', 900: '#18557F',
}
const teal = {
  50: '#EBF5F7', 100: '#D6ECEE', 200: '#ADD9DD', 300: '#75BEC6', 400: '#38A1AD',
  500: '#008796', 600: '#027A89', 700: '#04707E', 800: '#085F6C', 900: '#0B4D5A',
}
const aqua = {
  50: '#F3FCFD', 100: '#E8F8FA', 200: '#D1F2F5', 300: '#B1E9EE', 400: '#8EDFE7',
  500: '#6ED6E0', 600: '#63C0CA', 700: '#5AAEB8', 800: '#4C909A', 900: '#3C717B',
}
const green = {
  50: '#F3F9F4', 100: '#E7F2E9', 200: '#D0E5D4', 300: '#AFD4B6', 400: '#8CC196',
  500: '#6BAF78', 600: '#619E6E', 700: '#588F66', 800: '#4A785A', 900: '#3B5F4C',
}
const red = {
  50: '#FDF3F1', 100: '#FBE6E4', 200: '#F7CDC9', 300: '#F2ABA3', 400: '#EC867A',
  500: '#E66455', 600: '#CD5C50', 700: '#B8554B', 800: '#964944', 900: '#723E3C',
}
const yellow = {
  50: '#FFFBF5', 100: '#FFF6EB', 200: '#FFEDD7', 300: '#FFE1BC', 400: '#FFD49E',
  500: '#FFC882', 600: '#E3B477', 700: '#CBA36E', 800: '#A68760', 900: '#7E6A50',
}
const purple = {
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
        brandBlue, teal, aqua, green, red, yellow, purple, ink,
        ice: '#DBF7FF',

        /* Neutrale Töne der bestehenden Oberfläche auf Ink umbiegen */
        gray: ink,
        slate: ink,
        zinc: ink,
        neutral: ink,
        stone: ink,

        /* Akzentklassen auf die Skalen oben abbilden */
        blue: teal,
        sky: teal,
        cyan: aqua,
        indigo: purple,
        violet: purple,
        emerald: green,
        rose: red,
        orange: yellow,
        amber: yellow,

        /* primary = Hausfarbe */
        primary: brandBlue,

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
