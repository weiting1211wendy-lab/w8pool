import { useCallback } from 'react'
import { useAppData } from './useAppData'

export function useCustomTags() {
  const [allTags, setAllTags] = useAppData<string[]>('custom-tags', [])
  const [tagsMap, setTagsMap] = useAppData<Record<string, string[]>>('job-note-tags', {})

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed) return
    setAllTags((current) => current.includes(trimmed) ? current : [...current, trimmed])
  }, [setAllTags])

  const removeTag = useCallback((tag: string) => {
    setAllTags((current) => current.filter((item) => item !== tag))
  }, [setAllTags])

  const getJobTags = useCallback((jobId: string): string[] => {
    return tagsMap[jobId] ?? []
  }, [tagsMap])

  const setJobTags = useCallback((jobId: string, tags: string[]) => {
    setTagsMap((current) => ({ ...current, [jobId]: tags }))
  }, [setTagsMap])

  return { allTags, addTag, removeTag, getJobTags, setJobTags }
}
