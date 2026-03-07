'use client'
import { useRef, useState, useEffect } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'

interface ImageUploadProps {
  currentUrl?:  string | null
  onUpload:     (url: string) => void | Promise<void>
  folder:       string        // ImageKit folder, e.g. 'students', 'teachers', 'schools'
  initials?:    string        // fallback text when no photo
  shape?:       'circle' | 'square'
  size?:        number        // px, default 80
  disabled?:    boolean
  className?:   string
}

async function uploadToImageKit(file: File, folder: string): Promise<string> {
  const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY
  if (!publicKey) throw new Error('NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY is not set')

  const authRes = await fetch('/api/imagekit/auth')
  if (!authRes.ok) throw new Error('Failed to get upload auth')
  const { token, expire, signature } = await authRes.json()

  const form = new FormData()
  form.append('file', file)
  form.append('fileName', `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
  form.append('publicKey', publicKey)
  form.append('token', token)
  form.append('expire', String(expire))
  form.append('signature', signature)
  form.append('folder', folder)
  form.append('useUniqueFileName', 'true')

  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    body:   form,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message || 'Upload failed')
  }

  const data = await res.json() as { url: string }
  return data.url
}

export function ImageUpload({
  currentUrl, onUpload, folder, initials,
  shape = 'circle', size = 80, disabled, className,
}: ImageUploadProps) {
  const inputRef    = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview,   setPreview]   = useState<string | null | undefined>(currentUrl)

  // Sync preview when parent reloads currentUrl (e.g. after page reload)
  useEffect(() => { setPreview(currentUrl) }, [currentUrl])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return }

    // Optimistic local preview
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    setUploading(true)
    try {
      const url = await uploadToImageKit(file, folder)
      setPreview(url)
      await onUpload(url)
    } catch (err) {
      setPreview(currentUrl ?? null) // revert on error
      toast.error((err as Error).message || 'Upload failed')
    }
    setUploading(false)
    e.target.value = '' // allow re-selecting same file
  }

  const rounded = shape === 'circle' ? 'rounded-full' : 'rounded-xl'

  return (
    <div
      className={cn('relative group shrink-0', className)}
      style={{ width: size, height: size }}
    >
      {/* Main avatar area */}
      <div
        className={cn(
          'w-full h-full overflow-hidden flex items-center justify-center',
          'bg-accent-bg border-2 border-border',
          rounded,
          !disabled && 'cursor-pointer select-none',
        )}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        role={disabled ? undefined : 'button'}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        aria-label="Upload photo"
      >
        {preview ? (
          <img
            src={preview}
            alt="Photo"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-accent font-bold select-none" style={{ fontSize: size * 0.32 }}>
            {initials ?? '?'}
          </span>
        )}
      </div>

      {/* Hover overlay */}
      {!disabled && (
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center gap-0.5',
            'bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none',
            rounded,
          )}
        >
          {uploading
            ? <Loader2 size={Math.round(size * 0.22)} className="text-white animate-spin" />
            : (
              <>
                <Camera   size={Math.round(size * 0.22)} className="text-white" />
                <span className="text-white font-medium" style={{ fontSize: size * 0.13 }}>Change</span>
              </>
            )
          }
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
        disabled={disabled || uploading}
      />
    </div>
  )
}
