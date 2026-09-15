import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

type Option = { value: string; label: string }

type DropdownProps = {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
}

export function Dropdown({ options, value, onChange, placeholder = 'Selecione…', id }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative" id={id}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex h-[38px] w-full items-center justify-between rounded-md border border-border bg-white px-3 text-[13px] cursor-pointer transition-colors hover:border-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-1 ${
          selected?.value ? 'text-foreground' : 'text-muted-foreground'
        }`}
      >
        <span className="truncate">{selected?.label || placeholder}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/60 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-50 rounded-md border border-border bg-white py-0.5 shadow-lg">
          {options.map(opt => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value || '__empty'}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`flex w-full items-center justify-between px-3 py-2 text-[13px] cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-secondary/5 text-foreground font-medium'
                    : 'text-foreground hover:bg-background-muted'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-secondary" aria-hidden />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
