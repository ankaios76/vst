import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
}

const faqSections: { title: string; items: FAQItem[] }[] = [
  {
    title: 'Erste Schritte',
    items: [
      {
        question: 'Wie melde ich mich an?',
        answer: 'Öffnen Sie die GonoPBX-Weboberfläche in Ihrem Browser und geben Sie Ihren Benutzernamen und Ihr Passwort ein. Die Zugangsdaten erhalten Sie von Ihrem Administrator.',
      },
      {
        question: 'Wie ändere ich mein Passwort?',
        answer: 'Klicken Sie oben rechts auf Ihren Benutzernamen und wählen Sie "Passwort ändern". Geben Sie Ihr aktuelles Passwort und das neue Passwort ein. Administratoren können Passwörter auch unter Einstellungen → Benutzer ändern.',
      },
      {
        question: 'Was sehe ich auf dem Dashboard?',
        answer: 'Das Dashboard zeigt eine Übersicht aller Nebenstellen und Leitungen mit deren aktuellem Status (online/offline), die Anzahl aktiver Gespräche sowie den Systemzustand.',
      },
    ],
  },
  {
    title: 'Telefon einrichten',
    items: [
      {
        question: 'Welche Daten benötige ich für die Telefon-Registrierung?',
        answer: 'Sie benötigen: den SIP-Server (IP-Adresse des Servers), Ihre Nebenstellen-Nummer als Benutzername, das SIP-Passwort und den Port 5060 (UDP). Diese Daten finden Sie in Ihrer Willkommens-E-Mail oder fragen Sie Ihren Administrator.',
      },
      {
        question: 'Welche Telefone und Softphones werden unterstützt?',
        answer: 'GonoPBX ist kompatibel mit allen SIP-fähigen Geräten. Dazu gehören Hardware-Telefone von Yealink, Snom, Grandstream, Poly u.a. sowie Softphones wie MicroSIP (Windows), Linphone (alle Plattformen) oder Othe Othe Othe Othe Othe Othe Zoiper.',
      },
      {
        question: 'Mein Telefon registriert sich nicht – was kann ich tun?',
        answer: 'Prüfen Sie: 1) Stimmen SIP-Server, Benutzername und Passwort? 2) Ist der Port 5060/UDP in der Firewall freigegeben? 3) Ist die Nebenstelle auf dem Dashboard als "offline" angezeigt? Kontaktieren Sie Ihren Administrator, wenn das Problem bestehen bleibt.',
      },
    ],
  },
  {
    title: 'Anrufe & Rufnummern',
    items: [
      {
        question: 'Wie funktionieren eingehende Anrufe?',
        answer: 'Eingehende Anrufe werden über die zugewiesenen Rufnummern (DIDs) an Ihre Nebenstelle weitergeleitet. Einer Nebenstelle können mehrere Rufnummern zugeordnet sein, auch von verschiedenen Leitungen.',
      },
      {
        question: 'Wie funktionieren ausgehende Anrufe?',
        answer: 'Bei ausgehenden Anrufen wird die ausgehende Rufnummer als Caller-ID verwendet. Wenn einer Nebenstelle mehrere Rufnummern zugeordnet sind, können Sie unter Nebenstellen-Detail im Dropdown "Ausgehende Rufnummer" wählen, welche DID gesendet wird. Ohne Auswahl wird die erste zugeordnete Nummer verwendet.',
      },
      {
        question: 'Wo finde ich den Anrufverlauf?',
        answer: 'Unter "Anrufverlauf" im Hauptmenü sehen Sie alle ein- und ausgehenden Anrufe mit Datum, Uhrzeit, Dauer und Status. Sie können nach Datum und Nebenstelle filtern.',
      },
      {
        question: 'Was ist P-Asserted-Identity (PAI)?',
        answer: 'PAI ist ein SIP-Header, der die Identität des Anrufers gegenüber dem Provider bestätigt. Bei Nummernblöcken verlangen viele Provider, dass die Kopfnummer des Blocks als PAI gesendet wird. Sie können den PAI-Header pro Nebenstelle unter Nebenstellen-Detail → "P-Asserted-Identity (PAI)" konfigurieren. Die Domain wird automatisch vom Trunk übernommen.',
      },
      {
        question: 'Was ist eine Rufweiterleitung und wie richte ich sie ein?',
        answer: 'Eine Rufweiterleitung leitet Anrufe an eine andere Nummer weiter, wenn Sie nicht erreichbar sind oder nicht abnehmen. Klicken Sie im Dashboard auf Ihre Nebenstelle, um die Weiterleitungseinstellungen zu konfigurieren.',
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        question: 'Wie lege ich eine neue Nebenstelle an?',
        answer: 'Als Administrator: Gehen Sie zu Einstellungen → Benutzer → "Neuer Benutzer". Dort können Sie beim Anlegen direkt eine neue Nebenstelle erstellen und Rufnummern zuweisen.',
      },
      {
        question: 'Wie konfiguriere ich eine Leitung (Trunk)?',
        answer: 'Unter "Leitungen" im Hauptmenü können Sie SIP-Trunks anlegen und verwalten. Geben Sie die Zugangsdaten Ihres SIP-Providers ein (Server, Benutzername, Passwort) und definieren Sie den Rufnummernblock.',
      },
      {
        question: 'Wie konfiguriere ich den E-Mail-Versand?',
        answer: 'Unter Einstellungen → E-Mail können Sie den SMTP-Server konfigurieren. Dieser wird für Willkommens-E-Mails an neue Benutzer und Voicemail-Benachrichtigungen verwendet.',
      },
      {
        question: 'Wie aktualisiere ich GonoPBX?',
        answer: 'Am einfachsten über das Webinterface: Einstellungen → Server → Update → "Update installieren". Alternativ manuell per SSH: git pull origin main && docker compose up -d --build. Die Datenbank-Migrationen laufen automatisch beim Start.',
      },
      {
        question: 'Wie verbinde ich GonoPBX mit Home Assistant?',
        answer: 'Unter Einstellungen → Home Assistant können Sie die Integration aktivieren. Tragen Sie den MQTT-Broker ein und generieren Sie einen API-Key. GonoPBX sendet dann Anruf-Events per MQTT und stellt Sensoren für Nebenstellen, Trunks und aktive Anrufe bereit.',
      },
    ],
  },
]

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())
  const { user } = useAuth()

  const toggleItem = (key: string) => {
    setOpenItems(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Häufig gestellte Fragen</h1>

      {user?.role === 'admin' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Admin‑Handbuch</h2>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Download der aktuellen PDF‑Version für Betrieb, Wartung und Sicherheit.
            </p>
            <a
              href="https://gonopbx.de/admin-handbuch.pdf"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-colors"
              download
            >
              Handbuch (PDF)
            </a>
          </div>
        </div>
      )}

      {faqSections.map((section, si) => (
        <div key={si} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{section.title}</h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {section.items.map((item, qi) => {
              const key = `${si}-${qi}`
              const isOpen = openItems.has(key)
              return (
                <div key={qi}>
                  <button
                    onClick={() => toggleItem(key)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 pr-4">{item.question}</span>
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{item.answer}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
