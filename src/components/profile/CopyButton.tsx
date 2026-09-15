import { useState } from 'react'
import type { ReactNode } from 'react'

interface CopyButtonProps {
  getText: () => string
  label?: ReactNode
  feedback?: ReactNode
  className?: string
  title?: string
}

export default function CopyButton({
  getText,
  label = '复制',
  feedback = '已复制',
  className,
  title = '复制',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleClick = async () => {
    const text = getText()
    if (!text.trim()) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const classes = ['copy-btn', copied && 'copy-btn-copied', className]
    .filter(Boolean)
    .join(' ')

  return (
    <button type="button" className={classes} title={title} onClick={handleClick}>
      {copied ? feedback : label}
    </button>
  )
}
