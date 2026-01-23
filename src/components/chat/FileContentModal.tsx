import { useState, useEffect, useCallback } from 'react'
import { FileText, ImageIcon, Loader2, AlertCircle } from 'lucide-react'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Markdown } from '@/components/ui/markdown'

function isMarkdownFile(filename: string | null | undefined): boolean {
  if (!filename) return false
  return /\.(md|markdown)$/i.test(filename)
}

function isImageFile(filename: string | null | undefined): boolean {
  if (!filename) return false
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(filename)
}

interface FileContentModalProps {
  /** File path to display, or null to close the modal */
  filePath: string | null
  /** Callback when modal is closed */
  onClose: () => void
}

/**
 * Modal dialog for viewing file content from Read tool calls
 * Loads file content from disk when opened
 */
export function FileContentModal({ filePath, onClose }: FileContentModalProps) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadFileContent = useCallback(async (path: string) => {
    setIsLoading(true)
    setError(null)
    setContent(null)

    try {
      const fileContent = await invoke<string>('read_file_content', { path })
      setContent(fileContent)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (filePath && !isImageFile(filePath)) {
      loadFileContent(filePath)
    } else {
      // Reset state when modal closes or for image files (which don't need text loading)
      setContent(null)
      setError(null)
      setIsLoading(false)
    }
  }, [filePath, loadFileContent])

  const filename = filePath?.split('/').pop() ?? filePath

  const isImage = isImageFile(filename)

  return (
    <Dialog open={!!filePath} onOpenChange={open => !open && onClose()}>
      <DialogContent className="!max-w-[calc(100vw-4rem)] !w-[calc(100vw-4rem)] max-h-[85vh] p-4 bg-background/95 backdrop-blur-sm">
        <DialogTitle className="flex items-center gap-2">
          {isImage ? (
            <ImageIcon className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {filename}
          {filePath && (
            <span className="text-muted-foreground font-normal text-xs truncate max-w-[50%]">
              ({filePath})
            </span>
          )}
        </DialogTitle>
        <ScrollArea className="h-[calc(85vh-6rem)] mt-2">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading file...
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 py-4 px-3 bg-destructive/10 text-destructive rounded-md">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {isImage && filePath ? (
            <div className="flex justify-center p-4">
              <img
                src={convertFileSrc(filePath)}
                alt={filename ?? 'Image'}
                className="max-w-full max-h-[calc(85vh-8rem)] object-contain rounded-md"
              />
            </div>
          ) : (
            content !== null &&
            (isMarkdownFile(filename) ? (
              <div className="p-3">
                <Markdown className="text-sm">{content}</Markdown>
              </div>
            ) : (
              <pre className="text-xs font-mono whitespace-pre-wrap break-words p-3 bg-muted rounded-md">
                {content}
              </pre>
            ))
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
