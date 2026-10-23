import { useState } from 'react'
import { Phone, History, Menu, X, LogOut, Settings, HelpCircle, KeyRound, Moon, Sun, BookUser } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import ExtensionDetailPage from './pages/ExtensionDetailPage'
import TrunkDetailPage from './pages/TrunkDetailPage'
import CDRPage from './pages/CDRPage'
import LoginPage from './pages/LoginPage'
import SettingsPage from './pages/SettingsPage'
import FAQPage from './pages/FAQPage'
import ContactsPage from './pages/ContactsPage'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { Logo } from './components/Logo'
import { api } from './services/api'
import { useI18n } from './context/I18nContext'

type Page = 'dashboard' | 'extension-detail' | 'trunk-detail' | 'cdr' | 'settings' | 'faq' | 'contacts'

function AppContent() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { tr } = useI18n()
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [selectedExtension, setSelectedExtension] = useState<string>('')
  const [selectedTrunkId, setSelectedTrunkId] = useState<number>(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Password change modal
  const [showPwModal, setShowPwModal] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPwRepeat, setNewPwRepeat] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  const navigateToExtensionDetail = (ext: string) => {
    setSelectedExtension(ext)
    setCurrentPage('extension-detail')
  }

  const navigateToTrunkDetail = (id: number) => {
    setSelectedTrunkId(id)
    setCurrentPage('trunk-detail')
  }

  const handleChangePassword = async () => {
    setPwError('')
    setPwSuccess('')
    if (newPw.length < 6) {
      setPwError(tr('Das neue Passwort muss mindestens 6 Zeichen lang sein', 'The new password must be at least 6 characters long'))
      return
    }
    if (newPw !== newPwRepeat) {
      setPwError(tr('Die Passwörter stimmen nicht überein', 'The passwords do not match'))
      return
    }
    setPwSaving(true)
    try {
      await api.changeMyPassword(currentPw, newPw)
      setPwSuccess(tr('Passwort erfolgreich geändert', 'Password successfully changed'))
      setCurrentPw('')
      setNewPw('')
      setNewPwRepeat('')
      setTimeout(() => setShowPwModal(false), 1500)
    } catch (err: any) {
      setPwError(err.message || tr('Passwort konnte nicht geändert werden', 'Password could not be changed'))
    } finally {
      setPwSaving(false)
    }
  }

  const openPwModal = () => {
    setShowPwModal(true)
    setCurrentPw('')
    setNewPw('')
    setNewPwRepeat('')
    setPwError('')
    setPwSuccess('')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-subtle flex items-center justify-center">
        <div className="text-muted">{tr('Lade…', 'Loading…')}</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  const navigation = [
    { id: 'dashboard' as Page, name: tr('Dashboard', 'Dashboard'), icon: Phone },
    { id: 'cdr' as Page, name: tr('Anrufverlauf', 'Call History'), icon: History },
    { id: 'contacts' as Page, name: tr('Telefonbuch', 'Contacts'), icon: BookUser },
    { id: 'faq' as Page, name: 'FAQ', icon: HelpCircle },
    ...(user?.role === 'admin'
      ? [
          { id: 'settings' as Page, name: tr('Einstellungen', 'Settings'), icon: Settings },
        ]
      : []),
  ]

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onExtensionClick={navigateToExtensionDetail} onTrunkClick={navigateToTrunkDetail} onNavigate={(page) => setCurrentPage(page as Page)} />
      case 'extension-detail':
        return <ExtensionDetailPage extension={selectedExtension} onBack={() => setCurrentPage('dashboard')} />
      case 'trunk-detail':
        return <TrunkDetailPage trunkId={selectedTrunkId} onBack={() => setCurrentPage('dashboard')} />
      case 'cdr':
        return <CDRPage />
      case 'contacts':
        return <ContactsPage />
      case 'faq':
        return <FAQPage />
      case 'settings':
        return user?.role === 'admin' ? <SettingsPage /> : <Dashboard />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="min-h-screen bg-surface-subtle">
      {/* Header */}
      <header className="bg-surface border-b border-subtle sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo. Die VST-Wortmarke ist 4,33:1 und auf 32 px Hoehe nur
                138 px breit — deutlich ueber der CD-Mindestbreite von 80 px
                und schmal genug fuer jede Schirmbreite. Ein Umschalten auf
                die Bildmarke solo ist daher nicht noetig. */}
            <div className="flex items-center pr-6">
              <Logo className="h-8 w-auto" />
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-input transition-colors ${
                      currentPage === item.id
                        ? 'bg-brand text-on-primary'
                        : 'text-content hover:bg-surface-hover'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.name}
                  </button>
                )
              })}

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-input text-muted hover:bg-surface-hover transition-colors ml-2"
                title={theme === 'dark' ? tr('Light Mode', 'Light Mode') : tr('Dark Mode', 'Dark Mode')}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* User info & actions */}
              <div className="ml-2 pl-4 border-l border-subtle flex items-center gap-2">
                <button
                  onClick={openPwModal}
                  className="flex items-center gap-1.5 text-sm text-muted hover:text-content px-1 py-1 rounded-input hover:bg-surface-hover transition-colors"
                  title={`${user?.full_name || user?.username} – ${tr('Passwort ändern', 'Change password')}`}
                >
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-subtle"
                    />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-brand text-on-primary flex items-center justify-center text-sm font-semibold ring-2 ring-subtle">
                      {(user?.full_name || user?.username || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  {user?.role === 'admin' && (
                    <span className="text-xs bg-surface-accent text-content px-1.5 py-0.5 rounded-full">
                      {tr('Admin', 'Admin')}
                    </span>
                  )}
                </button>
                <button
                  onClick={logout}
                  className="flex items-center gap-1 text-muted hover:text-danger transition-colors px-2 py-1 rounded-input hover:bg-surface-hover"
                  title={tr('Abmelden', 'Sign out')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </nav>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-input text-muted hover:bg-surface-hover transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-input hover:bg-surface-hover"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6 text-content" />
                ) : (
                  <Menu className="w-6 h-6 text-content" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-subtle bg-surface">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id)
                    setMobileMenuOpen(false)
                  }}
                  className={`flex items-center gap-3 w-full px-4 py-3 ${
                    currentPage === item.id
                      ? 'bg-brand text-on-primary'
                      : 'text-content'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </button>
              )
            })}
            <button
              onClick={() => { openPwModal(); setMobileMenuOpen(false) }}
              className="flex items-center gap-3 w-full px-4 py-3 text-content border-t border-subtle"
            >
              <KeyRound className="w-5 h-5" />
              {tr('Passwort ändern', 'Change password')}
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-3 w-full px-4 py-3 text-danger border-t border-subtle"
            >
              <LogOut className="w-5 h-5" />
              {tr('Abmelden', 'Sign out')} ({user?.username})
            </button>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderPage()}
      </main>

      {/* Footer */}
      <footer className="bg-surface-subtle border-t border-subtle mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-muted space-y-1">
          <p>VST &middot; Open-Source-Telefonanlage</p>
          <p>Konzept, Entwicklung und Design, &copy; {new Date().getFullYear()} Norbert Hengsteler. {tr('Alle Rechte vorbehalten.', 'All rights reserved.')}</p>
          <p>
            {tr('Telefonanlage auf Basis von', 'PBX based on')}{' '}
            <a
              href="https://www.asterisk.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link hover:text-link-hover underline"
            >
              Asterisk
            </a>
            , einem Open-Source-Projekt von Sangoma Technologies
          </p>
        </div>
      </footer>

      {/* Password Change Modal */}
      {showPwModal && (
        <div className="fixed inset-0 bg-ink-900 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-card border border-subtle p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-headline text-lg font-semibold text-content">{tr('Passwort ändern', 'Change password')}</h2>
              <button onClick={() => setShowPwModal(false)} className="text-muted hover:text-content">
                <X className="w-5 h-5" />
              </button>
            </div>

            {pwError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-input text-sm">
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-input text-sm">
                {pwSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-content mb-1">{tr('Aktuelles Passwort', 'Current password')}</label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link focus:border-link outline-none bg-surface text-content"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-content mb-1">{tr('Neues Passwort', 'New password')}</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link focus:border-link outline-none bg-surface text-content"
                  placeholder={tr('Mindestens 6 Zeichen', 'At least 6 characters')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-content mb-1">{tr('Neues Passwort wiederholen', 'Repeat new password')}</label>
                <input
                  type="password"
                  value={newPwRepeat}
                  onChange={(e) => setNewPwRepeat(e.target.value)}
                  className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link focus:border-link outline-none bg-surface text-content"
                  onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowPwModal(false)}
                className="border border-brand text-brand hover:bg-surface-hover px-4 py-2 rounded-input transition-colors"
              >
                {tr('Abbrechen', 'Cancel')}
              </button>
              <button
                onClick={handleChangePassword}
                disabled={pwSaving || !currentPw || !newPw || !newPwRepeat}
                className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-on-primary px-4 py-2 rounded-input transition-colors"
              >
                {pwSaving ? tr('Speichern...', 'Saving...') : tr('Passwort ändern', 'Change password')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  )
}
