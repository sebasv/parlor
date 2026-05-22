import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import type { Locale } from '../lib/game'
import { createInstallPrompt, isFirefoxMobile, isIos, isStandalone } from '../lib/install'

const KOFI_URL = 'https://ko-fi.com/vqiio'

// Netlify Forms: a matching hidden static form lives in index.html so Netlify
// detects it at build time. Submissions are URL-encoded POSTs to '/'.
const FEEDBACK_FORM_NAME = 'feedback'

interface Labels {
  open: string
  close: string
  coffee: string
  share: string
  shareText: string
  shareCopied: string
  feedback: string
  feedbackTitle: string
  feedbackPlaceholder: string
  feedbackSubmit: string
  feedbackSent: string
  feedbackError: string
  cancel: string
  install: string
  installIos: string
  installIosBody: string
  installFirefox: string
  installFirefoxBody: string
  promise: string
}

const LABELS: Record<Locale, Labels> = {
  en: {
    open: 'Menu',
    close: 'Close',
    coffee: 'Buy me a coffee',
    share: 'Share',
    shareText: 'Parlor Games — a collection of local-multiplayer games.',
    shareCopied: 'Link copied',
    feedback: 'Send feedback',
    feedbackTitle: 'Send feedback',
    feedbackPlaceholder: 'What worked, what did not, what would you like to see?',
    feedbackSubmit: 'Send',
    feedbackSent: 'Thanks! Your feedback was sent.',
    feedbackError: 'Could not send. Please try again later.',
    cancel: 'Cancel',
    install: 'Install app',
    installIos: 'Install on iPhone or iPad',
    installIosBody: 'Tap the Share button in Safari, then choose "Add to Home Screen".',
    installFirefox: 'Install via Firefox menu',
    installFirefoxBody:
      'Open the menu (three dots, top right) and tap "Install app". Firefox does not let websites trigger this directly.',
    promise: 'No ads. No tracking. No in-app purchases.',
  },
  nl: {
    open: 'Menu',
    close: 'Sluiten',
    coffee: 'Trakteer op een koffie',
    share: 'Delen',
    shareText: 'Parlor Games — een verzameling lokale multiplayerspellen.',
    shareCopied: 'Link gekopieerd',
    feedback: 'Stuur feedback',
    feedbackTitle: 'Stuur feedback',
    feedbackPlaceholder: 'Wat ging goed, wat niet, wat zou je willen zien?',
    feedbackSubmit: 'Versturen',
    feedbackSent: 'Bedankt! Je feedback is verstuurd.',
    feedbackError: 'Versturen mislukt. Probeer het later opnieuw.',
    cancel: 'Annuleren',
    install: 'App installeren',
    installIos: 'Installeren op iPhone of iPad',
    installIosBody: 'Tik op de Deelknop in Safari en kies daarna "Zet op beginscherm".',
    installFirefox: 'Installeren via Firefox-menu',
    installFirefoxBody:
      'Open het menu (drie puntjes, rechtsboven) en tik op "App installeren". Firefox laat websites dit niet zelf openen.',
    promise: 'Geen advertenties. Geen tracking. Geen in-app aankopen.',
  },
}

interface Props {
  locale: () => Locale
}

type FeedbackStatus = 'idle' | 'sending' | 'sent' | 'error'

export function MetaMenu(props: Props) {
  const [open, setOpen] = createSignal(false)
  const [iosHint, setIosHint] = createSignal(false)
  const [firefoxHint, setFirefoxHint] = createSignal(false)
  const [copiedToast, setCopiedToast] = createSignal(false)
  const [feedbackOpen, setFeedbackOpen] = createSignal(false)
  const [feedbackText, setFeedbackText] = createSignal('')
  const [feedbackStatus, setFeedbackStatus] = createSignal<FeedbackStatus>('idle')
  const install = createInstallPrompt()
  const labels = () => LABELS[props.locale()]

  let dialog: HTMLDivElement | undefined
  let toastTimer: number | undefined
  // Honeypot: a real user never fills this. Bots that auto-fill every input
  // populate it and Netlify silently drops the submission.
  let honeypot = ''

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIosHint(false)
        setFirefoxHint(false)
        setFeedbackOpen(false)
        setOpen(false)
      }
    }
    const onClickAway = (e: MouseEvent) => {
      if (!open() || !dialog) return
      if (e.target instanceof Node && !dialog.contains(e.target)) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onClickAway)
    onCleanup(() => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onClickAway)
      if (toastTimer !== undefined) clearTimeout(toastTimer)
    })
  })

  const share = async () => {
    const url = window.location.origin
    const text = labels().shareText
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>
    }
    if (nav.share) {
      try {
        await nav.share({ title: 'Parlor Games', text, url })
      } catch {
        /* user cancelled — nothing to do */
      }
    } else {
      try {
        await navigator.clipboard.writeText(url)
        if (toastTimer !== undefined) clearTimeout(toastTimer)
        setCopiedToast(true)
        toastTimer = window.setTimeout(() => setCopiedToast(false), 2000)
      } catch {
        /* clipboard blocked — silently degrade */
      }
    }
    setOpen(false)
  }

  const triggerInstall = async () => {
    if (isStandalone()) return
    if (isIos()) {
      setIosHint(true)
      return
    }
    if (isFirefoxMobile() && !install.available()) {
      setFirefoxHint(true)
      return
    }
    await install.prompt()
    setOpen(false)
  }

  const showInstall = () => {
    if (isStandalone()) return false
    return install.available() || isIos() || isFirefoxMobile()
  }

  const openFeedback = () => {
    setOpen(false)
    setFeedbackText('')
    setFeedbackStatus('idle')
    honeypot = ''
    setFeedbackOpen(true)
  }

  const closeFeedback = () => {
    setFeedbackOpen(false)
  }

  const submitFeedback = async (e: Event) => {
    e.preventDefault()
    const message = feedbackText().trim()
    if (!message) return
    setFeedbackStatus('sending')
    const body = new URLSearchParams({
      'form-name': FEEDBACK_FORM_NAME,
      'bot-field': honeypot,
      locale: props.locale(),
      message,
    }).toString()
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setFeedbackStatus('sent')
    } catch (err) {
      // Logged so we can diagnose Netlify Forms misconfigurations (e.g. the
      // hidden static form not yet present in the deployed HTML, or the dev
      // server not handling POST /).
      console.error('feedback submit failed', err)
      setFeedbackStatus('error')
    }
  }

  return (
    <div class="meta-menu" ref={dialog}>
      <button
        type="button"
        class="meta-menu-trigger"
        aria-label={labels().open}
        aria-haspopup="true"
        aria-expanded={open()}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <span aria-hidden="true">⋯</span>
      </button>

      <Show when={open()}>
        <div class="meta-menu-panel" role="menu">
          <a
            class="meta-menu-item"
            role="menuitem"
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            {labels().coffee}
          </a>
          <button type="button" class="meta-menu-item" role="menuitem" onClick={share}>
            {labels().share}
          </button>
          <button type="button" class="meta-menu-item" role="menuitem" onClick={openFeedback}>
            {labels().feedback}
          </button>
          <Show when={showInstall()}>
            <button type="button" class="meta-menu-item" role="menuitem" onClick={triggerInstall}>
              {labels().install}
            </button>
          </Show>
          <p class="meta-menu-promise">{labels().promise}</p>
        </div>
      </Show>

      <Show when={iosHint()}>
        <div class="confirm-backdrop">
          <div
            class="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label={labels().installIos}
          >
            <h3>{labels().installIos}</h3>
            <p>{labels().installIosBody}</p>
            <div class="confirm-actions">
              <button type="button" class="confirm-ok" onClick={() => setIosHint(false)}>
                {labels().close}
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={firefoxHint()}>
        <div class="confirm-backdrop">
          <div
            class="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label={labels().installFirefox}
          >
            <h3>{labels().installFirefox}</h3>
            <p>{labels().installFirefoxBody}</p>
            <div class="confirm-actions">
              <button type="button" class="confirm-ok" onClick={() => setFirefoxHint(false)}>
                {labels().close}
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={copiedToast()}>
        <div class="share-toast" role="status" aria-live="polite">
          {labels().shareCopied}
        </div>
      </Show>

      <Show when={feedbackOpen()}>
        <div class="confirm-backdrop">
          <form
            class="confirm-dialog feedback-form"
            onSubmit={submitFeedback}
            role="dialog"
            aria-modal="true"
            aria-label={labels().feedbackTitle}
          >
            <h3>{labels().feedbackTitle}</h3>
            <Show
              when={feedbackStatus() !== 'sent'}
              fallback={
                <>
                  <p>{labels().feedbackSent}</p>
                  <div class="confirm-actions">
                    <button type="button" class="confirm-ok" onClick={closeFeedback}>
                      {labels().close}
                    </button>
                  </div>
                </>
              }
            >
              <textarea
                class="feedback-textarea"
                rows="5"
                required
                placeholder={labels().feedbackPlaceholder}
                value={feedbackText()}
                onInput={(e) => setFeedbackText(e.currentTarget.value)}
                disabled={feedbackStatus() === 'sending'}
              />
              {/* Honeypot input: visually hidden, never tabbable. */}
              <label class="feedback-honeypot" aria-hidden="true">
                Do not fill this field
                <input
                  type="text"
                  tabIndex={-1}
                  autocomplete="off"
                  onInput={(e) => {
                    honeypot = e.currentTarget.value
                  }}
                />
              </label>
              <Show when={feedbackStatus() === 'error'}>
                <p class="feedback-error">{labels().feedbackError}</p>
              </Show>
              <div class="confirm-actions">
                <button
                  type="button"
                  class="confirm-cancel"
                  onClick={closeFeedback}
                  disabled={feedbackStatus() === 'sending'}
                >
                  {labels().cancel}
                </button>
                <button
                  type="submit"
                  class="confirm-ok"
                  disabled={feedbackStatus() === 'sending' || !feedbackText().trim()}
                >
                  {labels().feedbackSubmit}
                </button>
              </div>
            </Show>
          </form>
        </div>
      </Show>
    </div>
  )
}
