import logoSeven from '@/assets/logo.png'
import { cn } from '@/lib/utils'

type AppLogoProps = {
  /** Caixa branca para contraste sobre fundo navy ou escuro */
  boxed?: boolean
  className?: string
  imgClassName?: string
}

export function AppLogo({ boxed = false, className, imgClassName }: AppLogoProps) {
  const img = (
    <img
      src={logoSeven}
      alt="Seven Sistemas de Automação"
      width={240}
      height={56}
      className={cn('h-12 w-auto max-w-[min(100%,260px)] object-contain object-left', imgClassName)}
    />
  )

  if (boxed) {
    return (
      <div
        className={cn(
          'inline-flex rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5',
          className,
        )}
      >
        {img}
      </div>
    )
  }

  return <div className={cn(className)}>{img}</div>
}
