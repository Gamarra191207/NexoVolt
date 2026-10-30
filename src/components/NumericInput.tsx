import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'

type NumericInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number
  onValueChange: (value: number) => void
}

/**
 * Numeric field with an editable draft. Unlike a directly controlled number input,
 * it can stay empty while the user replaces a value such as 0.
 */
export default function NumericInput({ value, onValueChange, min, max, onBlur, onFocus, ...props }: NumericInputProps) {
  const [draft, setDraft] = useState(String(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(String(value))
  }, [value])

  const commit = (raw: string) => {
    const normalized = raw.replace(',', '.')
    const parsed = Number(normalized)
    if (!normalized.trim() || !Number.isFinite(parsed)) return
    onValueChange(parsed)
  }

  return (
    <input
      {...props}
      type="number"
      min={min}
      max={max}
      value={draft}
      onFocus={(event) => {
        focused.current = true
        event.currentTarget.select()
        onFocus?.(event)
      }}
      onChange={(event) => {
        const next = event.currentTarget.value
        setDraft(next)
        commit(next)
      }}
      onBlur={(event) => {
        focused.current = false
        const parsed = Number(draft.replace(',', '.'))
        let next = Number.isFinite(parsed) && draft.trim() ? parsed : value
        if (min !== undefined) next = Math.max(Number(min), next)
        if (max !== undefined) next = Math.min(Number(max), next)
        onValueChange(next)
        setDraft(String(next))
        onBlur?.(event)
      }}
    />
  )
}
