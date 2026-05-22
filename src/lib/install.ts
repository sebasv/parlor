import { createSignal, onCleanup, onMount } from 'solid-js'

// The browser fires beforeinstallprompt when the PWA is installable. We must
// stash the event so we can trigger .prompt() later from a user gesture
// (clicking the install button) instead of immediately.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[]
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true
  // iOS uses a non-standard navigator.standalone for home-screen apps.
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return true
  // iPadOS 13+ reports as Mac with touch points.
  return ua.includes('Macintosh') && navigator.maxTouchPoints > 1
}

// Firefox does not implement beforeinstallprompt, but Firefox on Android does
// expose an "Install app" item in its own menu for valid PWAs. We can't trigger
// it from JS — we can only point the user at it.
export function isFirefoxMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Firefox/.test(ua) && /Mobile|Android/.test(ua)
}

export function createInstallPrompt() {
  const [available, setAvailable] = createSignal(false)
  let deferred: BeforeInstallPromptEvent | null = null

  onMount(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferred = e as BeforeInstallPromptEvent
      setAvailable(true)
    }
    const installed = () => {
      deferred = null
      setAvailable(false)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installed)
    onCleanup(() => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installed)
    })
  })

  const prompt = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred) return 'unavailable'
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    deferred = null
    setAvailable(false)
    return outcome
  }

  return { available, prompt }
}
