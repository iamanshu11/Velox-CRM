/** `data-tour` value of a sidebar link, e.g. navTarget('/dashboard/customers') → "nav:/dashboard/customers". */
export const navTarget = (path: string) => `nav:${path}`

/**
 * The element marked `data-tour="<id>"` if it is actually on screen, else null — a missing,
 * hidden, zero-size or off-canvas target (e.g. the sidebar slid away on a phone) means that
 * tour step is skipped.
 */
export function findVisibleTarget(id: string, root: ParentNode = document): HTMLElement | null {
  const el = root.querySelector<HTMLElement>(`[data-tour="${CSS.escape(id)}"]`)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= window.innerWidth || rect.top >= window.innerHeight) return null
  const style = window.getComputedStyle(el)
  if (style.visibility === 'hidden' || style.display === 'none') return null
  return el
}

/** Selector for an open dialog / drawer that the tour must wait for (its own UI excluded). */
const OPEN_DIALOG = '[role="dialog"]:not([data-onboarding-tour]), [role="alertdialog"], [aria-modal="true"]:not([data-onboarding-tour])'

export const isAnyDialogOpen = (root: ParentNode = document) => root.querySelector(OPEN_DIALOG) !== null
