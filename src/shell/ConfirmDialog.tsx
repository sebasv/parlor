import { Show } from 'solid-js'

interface Props {
  open: () => boolean
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog(props: Props) {
  return (
    <Show when={props.open()}>
      <div class="confirm-backdrop">
        <button
          type="button"
          class="confirm-backdrop-dismiss"
          aria-label="Close"
          onClick={props.onCancel}
        />
        <div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-label={props.title}>
          <h3>{props.title}</h3>
          <Show when={props.body}>
            <p>{props.body}</p>
          </Show>
          <div class="confirm-actions">
            <button type="button" class="confirm-cancel" onClick={props.onCancel}>
              {props.cancelLabel ?? 'Cancel'}
            </button>
            <button type="button" class="confirm-ok" onClick={props.onConfirm}>
              {props.confirmLabel ?? 'OK'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
