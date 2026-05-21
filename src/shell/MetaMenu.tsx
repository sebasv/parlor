import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import type { Locale } from '../lib/game'
import { createInstallPrompt, isIos, isStandalone } from '../lib/install'

// Ko-fi handle: update if the page lives at a different URL.
const KOFI_URL = 'https://ko-fi.com/sebasv'

// Feedback inbox. Stays a mailto: so the project keeps zero third-party
// dependencies; swap to a hosted form (Formspree, Tally, Web3Forms, or a
// Cloudflare Worker endpoint) by changing this href alone.
const FEEDBACK_EMAIL = 'mail@sebastiaanvermeulen.nl'

interface Labels {
  open: string
  close: string
  coffee: string
  share: string
  shareText: string
  feedback: string
  feedbackSubject: string
  install: string
  installIos: string
  installIosBody: string
  promise: string
}

const LABELS: Record<Locale, Labels> = {
  en: {
    open: 'Menu',
    close: 'Close',
    coffee: 'Buy me a coffee',
    share: 'Share',
    shareText: 'Parlor Games — a collection of local-multiplayer games.',
    feedback: 'Send feedback',
    feedbackSubject: 'Parlor Games feedback',
    install: 'Install app',
    installIos: 'Install on iPhone or iPad',
    installIosBody: 'Tap the Share button in Safari, then choose "Add to Home Screen".',
    promise: 'No ads. No tracking. No in-app purchases.',
  },
  nl: {
    open: 'Menu',
    close: 'Sluiten',
    coffee: 'Trakteer op een koffie',
    share: 'Delen',
    shareText: 'Parlor Games — een verzameling lokale multiplayerspellen.',
    feedback: 'Stuur feedback',
    feedbackSubject: 'Parlor Games feedback',
    install: 'App installeren',
    installIos: 'Installeren op iPhone of iPad',
    installIosBody: 'Tik op de Deelknop in Safari en kies daarna "Zet op beginscherm".',
    promise: 'Geen advertenties. Geen tracking. Geen in-app aankopen.',
  },
}

interface Props {
  locale: () => Locale
}

export function MetaMenu(props: Props) {
  const [open, setOpen] = createSignal(false)
  const [iosHint, setIosHint] = createSignal(false)
  const install = createInstallPrompt()
  const labels = () => LABELS[props.locale()]

  let dialog: HTMLDivElement | undefined

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIosHint(false)
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
      } catch {
        /* clipboard blocked — silently degrade */
      }
    }
    setOpen(false)
  }

  const triggerInstall = async () => {
    if (isIos() && !isStandalone()) {
      setIosHint(true)
      return
    }
    await install.prompt()
    setOpen(false)
  }

  const showInstall = () => {
    if (isStandalone()) return false
    return install.available() || isIos()
  }

  const feedbackHref = () => {
    const subject = encodeURIComponent(labels().feedbackSubject)
    return `mailto:${FEEDBACK_EMAIL}?subject=${subject}`
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
          <a
            class="meta-menu-item"
            role="menuitem"
            href={feedbackHref()}
            onClick={() => setOpen(false)}
          >
            {labels().feedback}
          </a>
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
    </div>
  )
}
