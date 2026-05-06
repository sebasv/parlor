const LOCALE_KEY = 'vg.locale'

export interface ConfirmOpts {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
}

interface LocaleStrings {
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
}

const STRINGS: Record<string, LocaleStrings> = {
  en: {
    title: 'Start a new game?',
    body: 'Your current progress will be lost.',
    confirmLabel: 'New game',
    cancelLabel: 'Keep playing',
  },
  nl: {
    title: 'Nieuw spel?',
    body: 'Je voortgang gaat verloren.',
    confirmLabel: 'Nieuw spel',
    cancelLabel: 'Doorspelen',
  },
}

function getLocale(): string {
  const raw = localStorage.getItem(LOCALE_KEY)
  return raw && raw in STRINGS ? raw : 'en'
}

export function defaultConfirmOpts(): ConfirmOpts {
  const locale = getLocale()
  return { ...STRINGS[locale] }
}

export function confirmDestructive(opts?: ConfirmOpts): Promise<boolean> {
  const locale = getLocale()
  const defaults = STRINGS[locale]
  const resolved: Required<ConfirmOpts> = {
    title: opts?.title ?? defaults.title,
    body: opts?.body ?? defaults.body,
    confirmLabel: opts?.confirmLabel ?? defaults.confirmLabel,
    cancelLabel: opts?.cancelLabel ?? defaults.cancelLabel,
  }

  return new Promise<boolean>((resolve) => {
    let settled = false

    function finish(result: boolean): void {
      if (settled) return
      settled = true
      backdrop.remove()
      document.removeEventListener('keydown', onKeyDown)
      resolve(result)
    }

    // Backdrop
    const backdrop = document.createElement('div')
    backdrop.className = 'confirm-backdrop'
    backdrop.setAttribute('role', 'presentation')

    // Dialog
    const dialog = document.createElement('div')
    dialog.className = 'confirm-dialog'
    dialog.setAttribute('role', 'alertdialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.setAttribute('aria-label', resolved.title)

    // Title
    const heading = document.createElement('h3')
    heading.textContent = resolved.title
    dialog.appendChild(heading)

    // Body
    if (resolved.body) {
      const body = document.createElement('p')
      body.textContent = resolved.body
      dialog.appendChild(body)
    }

    // Actions
    const actions = document.createElement('div')
    actions.className = 'confirm-actions'

    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'confirm-cancel'
    cancelBtn.textContent = resolved.cancelLabel

    const confirmBtn = document.createElement('button')
    confirmBtn.type = 'button'
    confirmBtn.className = 'confirm-ok'
    confirmBtn.textContent = resolved.confirmLabel

    actions.appendChild(cancelBtn)
    actions.appendChild(confirmBtn)
    dialog.appendChild(actions)

    backdrop.appendChild(dialog)

    // Backdrop click (outside dialog) dismisses
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish(false)
    })

    cancelBtn.addEventListener('click', () => finish(false))
    confirmBtn.addEventListener('click', () => finish(true))

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        finish(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.appendChild(backdrop)

    // Focus confirm button so keyboard users can confirm/dismiss immediately
    confirmBtn.focus()
  })
}
