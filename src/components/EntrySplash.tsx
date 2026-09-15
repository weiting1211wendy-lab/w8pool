import { useEffect, useRef, useState } from 'react'
import logo from '../assets/w8pool-logo-transparent.png'

export default function EntrySplash({ mode, userId, onComplete }: { mode: 'preview' | 'workspace'; userId?: string; onComplete: () => void }) {
  const [visible, setVisible] = useState(false)
  const completedRef = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('nb')) {
      params.delete('nb')
      const clean = params.toString() ? `?${params.toString()}${window.location.hash}` : `${window.location.pathname}${window.location.hash}`
      window.history.replaceState(null, '', clean)
      const key = mode === 'preview' ? 'w8pool-entry-splash:preview' : `w8pool-entry-splash:workspace:${userId ?? 'guest'}`
      try { sessionStorage.setItem(key, 'shown') } catch { /* 忽略 */ }
      return
    }
    const key = mode === 'preview' ? 'w8pool-entry-splash:preview' : `w8pool-entry-splash:workspace:${userId ?? 'guest'}`
    try {
      if (sessionStorage.getItem(key)) return
    } catch {
      // 存储不可用时仍可正常播放一次开场动画。
    }
    setVisible(true)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finish = () => {
      if (completedRef.current) return
      completedRef.current = true
      try {
        sessionStorage.setItem(key, 'shown')
      } catch {
        // 忽略浏览器存储不可用的情况。
      }
      setVisible(false)
      onComplete()
    }
    const timer = window.setTimeout(finish, reducedMotion ? 120 : 4300)
    return () => window.clearTimeout(timer)
  }, [mode, userId, onComplete])

  if (!visible) return null

  return (
    <div className="entry-splash" role="status" aria-label="W8Pool 开场动画">
      <div className="entry-splash-watermark" aria-hidden="true" />
      <div className="entry-splash-center">
        <div className="entry-splash-drop" aria-hidden="true" />
        <div className="entry-splash-ripples" aria-hidden="true"><i /><i /><i /></div>
        <img src={logo} alt="" className="entry-splash-logo" fetchPriority="high" />
        <p className="entry-splash-tagline">汇集机会，沉淀选择，<span className="entry-splash-tagline-end">抵达理想</span></p>
      </div>
      <button type="button" className="entry-splash-skip" onClick={() => { try { sessionStorage.setItem(mode === 'preview' ? 'w8pool-entry-splash:preview' : `w8pool-entry-splash:workspace:${userId ?? 'guest'}`, 'shown') } catch { /* 忽略浏览器存储不可用的情况。 */ } setVisible(false); onComplete() }}>跳过</button>
    </div>
  )
}
