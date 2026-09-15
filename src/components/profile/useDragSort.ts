import { useState } from 'react'
import type { DragEvent } from 'react'

export function useDragSort<T>(
  items: T[],
  onChange: (next: T[]) => void,
) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const dragStart = (index: number) => (e: DragEvent<HTMLElement>) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const dragOver = (index: number) => (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    const next = [...items]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(index, 0, moved)
    setDragIndex(index)
    onChange(next)
  }

  const dragEnd = () => setDragIndex(null)

  return { dragStart, dragOver, dragEnd }
}
