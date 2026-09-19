import { useRef, useState } from 'react'
import { IconImage, IconUpload, IconFile } from './icons.jsx'
import { isNativePlatform, pickNativeImage } from '../../lib/native.js'

export default function FileDropzone({
  accept,
  onFile,
  uploading = false,
  previewUrl,
  fileLabel,
  hint,
  label,
  kind = 'image',
  disabled = false,
}) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [picking, setPicking] = useState(false)

  const handleFiles = (files) => {
    const file = files?.[0]
    if (!file || disabled) return
    onFile(file)
  }

  const openPicker = async () => {
    if (disabled || picking) return

    // Image picks use the native camera/gallery sheet inside the app.
    if (kind === 'image' && isNativePlatform()) {
      setPicking(true)
      try {
        const file = await pickNativeImage({ fileName: 'upload.jpg' })
        if (file) onFile(file)
      } catch (err) {
        // User cancel is normal; ignore. Real errors bubble via toast upstream if needed.
        if (err?.message && !/cancel/i.test(String(err.message))) {
          console.warn('[FileDropzone] native image pick failed', err)
        }
      } finally {
        setPicking(false)
      }
      return
    }

    inputRef.current?.click()
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (isNativePlatform() && kind === 'image') return
    handleFiles(e.dataTransfer.files)
  }

  const hasPreview = Boolean(previewUrl || fileLabel)
  const nativeImage = kind === 'image' && isNativePlatform()

  return (
    <div>
      {label && <p className="admin-label">{label}</p>}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled && !nativeImage) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={openPicker}
        className={`relative rounded-xl border-2 border-dashed cursor-pointer transition-all duration-150
                    ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
                    ${
                      dragOver
                        ? 'border-maroon bg-maroon/5'
                        : hasPreview
                          ? 'border-ink/10 bg-ivory'
                          : 'border-ink/15 bg-sand/40 hover:border-maroon/40 hover:bg-sand/70'
                    }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />

        {uploading || picking ? (
          <div className="px-5 py-8 flex flex-col items-center gap-3">
            <div className="w-full max-w-[220px] h-1.5 rounded-full bg-ink/10 overflow-hidden">
              <div className="h-full w-1/2 rounded-full bg-maroon animate-upload-indeterminate" />
            </div>
            <p className="text-xs font-medium text-ink-soft">
              {picking ? 'Opening camera…' : 'Uploading…'}
            </p>
          </div>
        ) : hasPreview ? (
          <div className="flex items-center gap-4 px-4 py-3.5">
            {kind === 'image' && previewUrl ? (
              <img
                src={previewUrl}
                alt=""
                className="w-14 h-14 rounded-lg object-contain bg-sand shrink-0 ring-1 ring-ink/10 p-0.5"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-sand text-maroon flex items-center justify-center shrink-0">
                <IconFile className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink truncate">
                {fileLabel || 'File attached'}
              </p>
              <p className="text-xs text-ink-soft mt-0.5">
                {nativeImage ? 'Tap to take or choose a photo' : 'Click or drop to replace'}
              </p>
            </div>
            <span className="text-ink-soft/50 shrink-0">
              <IconUpload className="w-4 h-4" />
            </span>
          </div>
        ) : (
          <div className="px-5 py-8 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-xl bg-white text-maroon flex items-center justify-center mb-3 shadow-sm">
              {kind === 'image' ? <IconImage className="w-5 h-5" /> : <IconUpload className="w-5 h-5" />}
            </div>
            <p className="text-sm font-semibold text-ink">
              {nativeImage
                ? 'Take a photo or choose from gallery'
                : `Drop ${kind === 'image' ? 'an image' : 'a file'} here`}
            </p>
            <p className="text-xs text-ink-soft mt-1">
              {nativeImage ? 'Uses the device camera' : 'or click to browse'}
            </p>
            {hint && <p className="text-[11px] text-ink-soft/80 mt-2">{hint}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
