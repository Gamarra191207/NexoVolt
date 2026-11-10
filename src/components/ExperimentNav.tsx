import type { KeyboardEvent } from 'react'

export type ExperimentOption<T extends string> = {
  id: T
  title: string
  description: string
}

type ExperimentNavProps<T extends string> = {
  activeId: T
  ariaLabel: string
  items: readonly ExperimentOption<T>[]
  onSelect: (id: T) => void
}

export default function ExperimentNav<T extends string>({ activeId, ariaLabel, items, onSelect }: ExperimentNavProps<T>) {
  function moveSelection(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : direction ? (index + direction + items.length) % items.length : index
    if (!direction && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    onSelect(items[nextIndex].id)
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons?.[nextIndex]?.focus()
  }

  return <nav className="experiment-access" aria-label={ariaLabel}>
    <div className="experiment-access-list" role="tablist" aria-label={ariaLabel}>
      {items.map((item, index) => <button
        key={item.id}
        type="button"
        role="tab"
        aria-selected={activeId === item.id}
        tabIndex={activeId === item.id ? 0 : -1}
        className={activeId === item.id ? 'active' : ''}
        onClick={() => onSelect(item.id)}
        onKeyDown={(event) => moveSelection(event, index)}
      >
        <span className="experiment-access-copy"><strong>{item.title}</strong></span>
      </button>)}
    </div>
  </nav>
}
