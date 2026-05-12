"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const PROFILE_PHOTOS_BUCKET = 'profile-photos'
const MAX_PHOTO_SIZE = 2 * 1024 * 1024 // 2MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function getProfilePhotoUrl(employeeId: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  // Use a cache-busting param to force reload after upload
  return `${supabaseUrl}/storage/v1/object/public/${PROFILE_PHOTOS_BUCKET}/${employeeId}?t=${Date.now()}`
}

export function useProfilePhoto(employeeId: string | null) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check if a profile photo exists on mount
  useEffect(() => {
    if (!employeeId) return
    const supabase = createClient()
    supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .list('', { search: employeeId, limit: 1 })
      .then(({ data }) => {
        if (data && data.length > 0 && data.some(f => f.name === employeeId)) {
          setPhotoUrl(getProfilePhotoUrl(employeeId))
        }
      })
      .catch(() => { /* bucket may not exist yet */ })
  }, [employeeId])

  const handleUpload = useCallback(async (file: File) => {
    if (!employeeId) return
    setError(null)

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('Please select a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setError('Image must be under 2MB.')
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const filePath = employeeId
      const { error: uploadError } = await supabase.storage
        .from(PROFILE_PHOTOS_BUCKET)
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) {
        setError(uploadError.message)
      } else {
        setPhotoUrl(getProfilePhotoUrl(employeeId))
      }
    } catch (err) {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [employeeId])

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    // Reset so the same file can be re-selected
    if (e.target) e.target.value = ''
  }, [handleUpload])

  return { photoUrl, uploading, error, fileInputRef, openFilePicker, onFileChange }
}
