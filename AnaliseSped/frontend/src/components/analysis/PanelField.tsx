type PanelFieldProps = {
  label: string
  value: string
  /** Texto longo — usa bloco */
  multiline?: boolean
}

export function PanelField({ label, value, multiline }: PanelFieldProps) {
  return (
    <div className="border-b border-border/80 py-2.5 last:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 text-sm text-foreground ${multiline ? 'whitespace-pre-wrap leading-relaxed' : 'font-medium'}`}
      >
        {value}
      </dd>
    </div>
  )
}
