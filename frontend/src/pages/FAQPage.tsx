import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/I18nContext'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
}

const faqSectionsDe: { title: string; items: FAQItem[] }[] = [
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

const faqSectionsEn: { title: string; items: FAQItem[] }[] = [
  {
    title: 'Getting started',
    items: [
      {
        question: 'How do I sign in?',
        answer: 'Open the GonoPBX web interface in your browser and enter your username and password. You will receive your credentials from your administrator.',
      },
      {
        question: 'How do I change my password?',
        answer: 'Click your username in the top right and choose "Change password". Enter your current password and the new password. Admins can also change passwords under Settings → Users.',
      },
      {
        question: 'What do I see on the dashboard?',
        answer: 'The dashboard shows an overview of all extensions and trunks with their current status (online/offline), the number of active calls, and overall system status.',
      },
    ],
  },
  {
    title: 'Set up your phone',
    items: [
      {
        question: 'Which data do I need for phone registration?',
        answer: 'You need: the SIP server (server IP), your extension number as username, the SIP password, and port 5060 (UDP). You can find these in your welcome email or ask your administrator.',
      },
      {
        question: 'Which phones and softphones are supported?',
        answer: 'GonoPBX is compatible with all SIP-capable devices. This includes hardware phones from Yealink, Snom, Grandstream, Poly, etc., and softphones like MicroSIP (Windows), Linphone (all platforms) or Zoiper.',
      },
      {
        question: 'My phone won’t register — what can I do?',
        answer: 'Check: 1) Are SIP server, username and password correct? 2) Is port 5060/UDP allowed in the firewall? 3) Is the extension shown as "offline" on the dashboard? Contact your admin if the issue persists.',
      },
    ],
  },
  {
    title: 'Calls & numbers',
    items: [
      {
        question: 'How do inbound calls work?',
        answer: 'Inbound calls are routed to your extension via the assigned numbers (DIDs). An extension can have multiple numbers, even from different trunks.',
      },
      {
        question: 'How do outbound calls work?',
        answer: 'For outbound calls, the selected outbound number is sent as caller ID. If multiple numbers are assigned, you can choose the DID under Extension details → "Outbound number". If none is selected, the first assigned number is used.',
      },
      {
        question: 'Where can I find the call history?',
        answer: 'Under "Call history" in the main menu you can see all inbound and outbound calls with date, time, duration and status. You can filter by date and extension.',
      },
      {
        question: 'What is P-Asserted-Identity (PAI)?',
        answer: 'PAI is a SIP header that confirms the caller identity to the provider. With number blocks, many providers require the main number of the block as PAI. You can configure PAI per extension under Extension details → "P-Asserted-Identity (PAI)". The domain is taken from the trunk.',
      },
      {
        question: 'What is call forwarding and how do I set it up?',
        answer: 'Call forwarding routes calls to another number when you are unavailable or don’t answer. Click your extension on the dashboard to configure forwarding.',
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        question: 'How do I create a new extension?',
        answer: 'As admin: go to Settings → Users → "New user". There you can create a new extension and assign numbers during user creation.',
      },
      {
        question: 'How do I configure a trunk?',
        answer: 'Under "Trunks" in the main menu you can create and manage SIP trunks. Enter your provider credentials (server, username, password) and define the number block.',
      },
      {
        question: 'How do I configure email delivery?',
        answer: 'Under Settings → Email you can configure the SMTP server. It is used for welcome emails and voicemail notifications.',
      },
      {
        question: 'How do I update GonoPBX?',
        answer: 'Easiest via the web UI: Settings → Server → Update → "Install update". Alternatively via SSH: git pull origin main && docker compose up -d --build. Database migrations run automatically on startup.',
      },
      {
        question: 'How do I connect GonoPBX to Home Assistant?',
        answer: 'Under Settings → Home Assistant you can enable the integration. Enter the MQTT broker and generate an API key. GonoPBX will send call events via MQTT and provide sensors for extensions, trunks and active calls.',
      },
    ],
  },
]

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())
  const { user } = useAuth()
  const { tr, lang } = useI18n()

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
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">{tr('Häufig gestellte Fragen', 'Frequently asked questions')}</h1>

      {user?.role === 'admin' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{tr('Admin‑Handbuch', 'Admin handbook')}</h2>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {tr('Download der aktuellen PDF‑Version für Betrieb, Wartung und Sicherheit.', 'Download the current PDF for operations, maintenance and security.')}
            </p>
            <a
              href="https://gonopbx.de/admin-handbuch.pdf"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-colors"
              download
            >
              {tr('Handbuch (PDF)', 'Handbook (PDF)')}
            </a>
          </div>
        </div>
      )}

      {(lang === 'en' ? faqSectionsEn : faqSectionsDe).map((section, si) => (
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
