import { useEffect, useState } from 'react'
import {
  getFileSaveState,
  reloadFromFile,
  requestReadFile,
  requestSaveFile,
  saveNow,
} from '../utils/filePersistence'
import type { FileSaveState } from '../utils/filePersistence'

export default function FileSaveButton({ prefix = '' }: { prefix?: string }) {
  const [state, setState] = useState<FileSaveState>('none')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    void getFileSaveState().then(setState)
  }, [])

  const label =
    state === 'ready'
      ? '已选择保存路径'
      : state === 'need-auth'
        ? '授权本地保存'
        : state === 'unsupported'
          ? '浏览器不支持本地文件'
          : '选择保存路径'

  const handlePickPath = async () => {
    if (busy) return
    setBusy(true)
    try {
       if (state === 'none' || state === 'ready') {
        await requestSaveFile(prefix)
        setState('ready')
      } else if (state === 'need-auth') {
        await requestReadFile(prefix)
        const next = await getFileSaveState()
        setState(next)
        if (next === 'ready') {
          window.location.reload()
        }
      }
    } catch {
      // 用户取消了文件选择或授权，保持原状态
    } finally {
      setBusy(false)
    }
  }

  const handleSaveNow = async () => {
    if (saving) return
    setSaving(true)
    try {
      const ok = await saveNow(prefix)
      window.alert(
        ok
          ? '已把当前所有数据的最新状态更新到本地文件。'
          : '保存失败：请先点击「选择保存路径」完成授权，或浏览器不支持本地文件。',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleReload = async () => {
    if (syncing) return
    if (state !== 'ready' && state !== 'need-auth') {
      window.alert('请先点击「选择保存路径」完成授权。')
      return
    }
    if (!window.confirm('将从本地文件读取数据并覆盖网页当前数据，确认继续？')) {
      return
    }
    setSyncing(true)
    try {
      const ok = await reloadFromFile(prefix)
      if (ok) {
        window.alert('已从本地文件同步最新数据，即将刷新页面。')
        window.location.reload()
      } else {
        window.alert(
          '同步失败：未能读取本地文件（可能已移动、被删除，或浏览器权限不足）。',
        )
      }
    } finally {
      setSyncing(false)
    }
  }

  if (state === 'unsupported') {
    return (
      <div className="pool-action-grid">
        <button type="button" className="btn btn-outline" disabled>
          浏览器不支持本地文件
        </button>
      </div>
    )
  }

  const isReady = state === 'ready'

  return (
    <div className="pool-action-grid">
      <button
        type="button"
        className={`btn btn-outline ${
          state === 'ready' ? 'btn-ready' : ''
        }`}
        onClick={handlePickPath}
        disabled={busy}
        title={
          state === 'ready'
            ? '已选择保存路径，数据会实时写入。点击可重新选择保存路径。'
            : '第 1 步：在对话框中选择一个本机文件作为保存位置，数据会自动写入'
        }
      >
        {busy ? '处理中…' : label}
      </button>
      <button
        type="button"
        className="btn btn-outline"
        onClick={handleSaveNow}
        disabled={saving || !isReady}
        title={isReady ? '把网页当前所有数据的最新状态立即写入已选择的本地文件' : '请先选择保存路径'}
      >
        {saving ? '保存中…' : '写入本地文件'}
      </button>
      <button
        type="button"
        className="btn btn-outline"
        onClick={handleReload}
        disabled={syncing || !isReady}
        title={isReady ? '用本地文件的内容覆盖网页当前数据' : '请先选择保存路径'}
      >
        {syncing ? '同步中…' : '从文件恢复'}
      </button>
      {!isReady && (
        <p className="file-save-hint">⚠️ 请先点「选择保存路径」指定文件后再使用其他功能</p>
      )}
      <p className="file-save-caption">
        先点「{state === 'ready' ? '已选择保存路径' : '选择保存路径'}」指定文件，之后数据会自动写入；「写入本地文件」可随时手动保存最新状态，「从文件恢复」则用文件内容覆盖网页当前数据。
      </p>
    </div>
  )
}
