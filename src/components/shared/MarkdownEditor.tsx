import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Bold, Italic, Strikethrough, Link2, Image, Code, List, ListOrdered,
  Heading1, Heading2, Heading3, Quote, Minus, Eye, Edit3, Hash,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useWikiLinks } from '@/contexts/WikiLinkContext'

// Converts [[title]] → [title](wikilink:title) for ReactMarkdown processing
function processWikiLinks(content: string): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (_, title) =>
    `[${title}](wikilink:${encodeURIComponent(title)})`
  )
}

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number
  className?: string
  onImageUpload?: (file: File) => Promise<string>  // returns URL
}

type ToolbarAction = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  action: (textarea: HTMLTextAreaElement, value: string, onChange: (v: string) => void) => void
}

function wrapSelection(
  textarea: HTMLTextAreaElement,
  value: string,
  onChange: (v: string) => void,
  before: string,
  after: string,
  placeholder = ''
) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = value.slice(start, end) || placeholder
  const newValue = value.slice(0, start) + before + selected + after + value.slice(end)
  onChange(newValue)
  setTimeout(() => {
    textarea.focus()
    const newStart = start + before.length
    const newEnd = newStart + selected.length
    textarea.setSelectionRange(newStart, newEnd)
  }, 0)
}

function prependLine(
  textarea: HTMLTextAreaElement,
  value: string,
  onChange: (v: string) => void,
  prefix: string,
  placeholder = 'Texto'
) {
  const start = textarea.selectionStart
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const lineEnd = value.indexOf('\n', start)
  const lineEndActual = lineEnd === -1 ? value.length : lineEnd
  const line = value.slice(lineStart, lineEndActual)
  const newLine = line.startsWith(prefix) ? line.slice(prefix.length) : prefix + (line || placeholder)
  const newValue = value.slice(0, lineStart) + newLine + value.slice(lineEndActual)
  onChange(newValue)
  setTimeout(() => {
    textarea.focus()
    textarea.setSelectionRange(lineStart + newLine.length, lineStart + newLine.length)
  }, 0)
}

const toolbarActions: (ToolbarAction | 'sep')[] = [
  {
    icon: Bold,
    title: 'Negrito',
    action: (ta, v, c) => wrapSelection(ta, v, c, '**', '**', 'texto'),
  },
  {
    icon: Italic,
    title: 'Itálico',
    action: (ta, v, c) => wrapSelection(ta, v, c, '_', '_', 'texto'),
  },
  {
    icon: Strikethrough,
    title: 'Tachado',
    action: (ta, v, c) => wrapSelection(ta, v, c, '~~', '~~', 'texto'),
  },
  'sep',
  {
    icon: Heading1,
    title: 'Título 1',
    action: (ta, v, c) => prependLine(ta, v, c, '# '),
  },
  {
    icon: Heading2,
    title: 'Título 2',
    action: (ta, v, c) => prependLine(ta, v, c, '## '),
  },
  {
    icon: Heading3,
    title: 'Título 3',
    action: (ta, v, c) => prependLine(ta, v, c, '### '),
  },
  'sep',
  {
    icon: List,
    title: 'Lista',
    action: (ta, v, c) => prependLine(ta, v, c, '- '),
  },
  {
    icon: ListOrdered,
    title: 'Lista numerada',
    action: (ta, v, c) => prependLine(ta, v, c, '1. '),
  },
  {
    icon: Quote,
    title: 'Citação',
    action: (ta, v, c) => prependLine(ta, v, c, '> '),
  },
  'sep',
  {
    icon: Code,
    title: 'Código',
    action: (ta, v, c) => wrapSelection(ta, v, c, '`', '`', 'código'),
  },
  {
    icon: Minus,
    title: 'Separador',
    action: (ta, v, c) => {
      const start = ta.selectionStart
      const newValue = v.slice(0, start) + '\n---\n' + v.slice(start)
      c(newValue)
      setTimeout(() => { ta.focus(); ta.setSelectionRange(start + 5, start + 5) }, 0)
    },
  },
  'sep',
  {
    icon: Link2,
    title: 'Link',
    action: (ta, v, c) => {
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const selected = v.slice(start, end) || 'texto do link'
      const insertion = `[${selected}](url)`
      const newValue = v.slice(0, start) + insertion + v.slice(end)
      c(newValue)
      setTimeout(() => {
        ta.focus()
        const urlStart = start + selected.length + 3
        ta.setSelectionRange(urlStart, urlStart + 3)
      }, 0)
    },
  },
  {
    icon: Image,
    title: 'Imagem',
    action: (ta, v, c) => {
      const start = ta.selectionStart
      const insertion = '![alt](url)'
      const newValue = v.slice(0, start) + insertion + v.slice(start)
      c(newValue)
      setTimeout(() => { ta.focus(); ta.setSelectionRange(start + 2, start + 5) }, 0)
    },
  },
  'sep',
  {
    icon: Hash,
    title: 'Link interno [[...]]',
    action: (ta, v, c) => wrapSelection(ta, v, c, '[[', ']]', 'título da nota'),
  },
]

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Escreva em markdown...',
  minHeight = 200,
  className,
  onImageUpload,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleAction = useCallback(
    (action: ToolbarAction['action']) => {
      const ta = textareaRef.current
      if (!ta) return
      action(ta, value, onChange)
    },
    [value, onChange]
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLTextAreaElement>) => {
      if (!onImageUpload) return
      e.preventDefault()
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
      for (const file of files) {
        try {
          const url = await onImageUpload(file)
          const insertion = `![${file.name}](${url})`
          onChange(value + '\n' + insertion)
        } catch {
          // skip failed uploads
        }
      }
    },
    [onImageUpload, value, onChange]
  )

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!onImageUpload) return
      const items = Array.from(e.clipboardData.items).filter((item) => item.type.startsWith('image/'))
      if (items.length === 0) return
      e.preventDefault()
      for (const item of items) {
        const file = item.getAsFile()
        if (!file) continue
        try {
          const url = await onImageUpload(file)
          const insertion = `![imagem](${url})`
          onChange(value + '\n' + insertion)
        } catch {
          // skip
        }
      }
    },
    [onImageUpload, value, onChange]
  )

  return (
    <div className={cn('border border-gray-200 rounded-lg overflow-hidden bg-white', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50 flex-wrap">
        {toolbarActions.map((item, i) =>
          item === 'sep' ? (
            <div key={i} className="w-px h-5 bg-gray-200 mx-1" />
          ) : (
            <button
              key={item.title}
              type="button"
              title={item.title}
              onClick={() => handleAction(item.action)}
              className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <item.icon className="w-3.5 h-3.5" />
            </button>
          )
        )}
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')}
          className="text-xs h-7 gap-1"
        >
          {mode === 'edit' ? (
            <><Eye className="w-3.5 h-3.5" /> Prévia</>
          ) : (
            <><Edit3 className="w-3.5 h-3.5" /> Editar</>
          )}
        </Button>
      </div>

      {/* Editor / Preview */}
      {mode === 'edit' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onDrop={handleDrop}
          onPaste={handlePaste}
          className="w-full resize-y p-3 text-sm font-mono text-gray-900 focus:outline-none leading-relaxed bg-white"
          style={{ minHeight }}
        />
      ) : (
        <div
          className="prose prose-sm max-w-none p-4 text-gray-900 leading-relaxed"
          style={{ minHeight }}
        >
          {value ? (
            <WikiMarkdown content={value} />
          ) : (
            <p className="text-gray-400 italic">Nenhum conteúdo para pré-visualizar.</p>
          )}
        </div>
      )}
    </div>
  )
}

// Internal component that handles wiki link rendering with navigation
function WikiMarkdown({ content }: { content: string }) {
  const { navigate } = useWikiLinks()
  const processed = processWikiLinks(content)
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children, ...props }) => {
          if (href?.startsWith('wikilink:')) {
            const title = decodeURIComponent(href.slice('wikilink:'.length))
            return (
              <span
                onClick={() => navigate(title)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-700 text-xs cursor-pointer hover:bg-orange-100 font-medium no-underline"
                title={`Link interno: ${title}`}
              >
                <Hash className="w-3 h-3 inline-block flex-shrink-0" />
                {title}
              </span>
            )
          }
          return <a href={href} {...props}>{children}</a>
        },
      }}
    >
      {processed}
    </ReactMarkdown>
  )
}

// Read-only markdown renderer
export function MarkdownRenderer({ content, className }: { content: string; className?: string }) {
  if (!content) return null
  return (
    <div className={cn('prose prose-sm max-w-none text-gray-800 leading-relaxed', className)}>
      <WikiMarkdown content={content} />
    </div>
  )
}

// ─── Inline markdown field ────────────────────────────────────────────────────

// Heading component factory — shows # marker on hover
function makeInlineHeading(level: 1 | 2 | 3) {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
  const marker = '#'.repeat(level)
  return function InlineHeading({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
      <Tag {...props} className="relative group">
        <span
          className="absolute right-full pr-1.5 opacity-0 group-hover:opacity-40 text-gray-400 font-normal select-none transition-opacity duration-100 pointer-events-none whitespace-nowrap"
          style={{ top: '0.1em', fontSize: '0.7em' }}
        >
          {marker}
        </span>
        {children}
      </Tag>
    )
  }
}

const inlineHeadingComponents = {
  h1: makeInlineHeading(1),
  h2: makeInlineHeading(2),
  h3: makeInlineHeading(3),
}

// WikiMarkdown variant with heading # hover support
function InlineWikiMarkdown({ content }: { content: string }) {
  const { navigate } = useWikiLinks()
  const processed = processWikiLinks(content)
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        ...inlineHeadingComponents,
        a: ({ href, children, ...props }) => {
          if (href?.startsWith('wikilink:')) {
            const title = decodeURIComponent(href.slice('wikilink:'.length))
            return (
              <span
                onClick={() => navigate(title)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-700 text-xs cursor-pointer hover:bg-orange-100 font-medium no-underline"
                title={`Link interno: ${title}`}
              >
                <Hash className="w-3 h-3 inline-block flex-shrink-0" />
                {title}
              </span>
            )
          }
          return <a href={href} {...props}>{children}</a>
        },
      }}
    >
      {processed}
    </ReactMarkdown>
  )
}

// Read-only renderer with heading hover (used by InlineMarkdownField in view mode)
export function InlineMarkdownRenderer({ content, className }: { content: string; className?: string }) {
  if (!content) return null
  return (
    <div className={cn('prose prose-sm max-w-none pl-5 dark:prose-invert text-gray-800 leading-relaxed', className)}>
      <InlineWikiMarkdown content={content} />
    </div>
  )
}

// Shared toolbar used by InlineMarkdownField
// onMouseDown + preventDefault keeps the textarea focused while clicking buttons
function InlineMdToolbar({
  value,
  onChange,
  textareaRef,
}: {
  value: string
  onChange: (v: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}) {
  const handleAction = useCallback(
    (action: ToolbarAction['action']) => {
      const ta = textareaRef.current
      if (!ta) return
      action(ta, value, onChange)
    },
    [value, onChange, textareaRef]
  )
  return (
    <div className="flex items-center gap-0.5 flex-wrap px-1.5 py-1 border-b border-gray-200 bg-gray-50">
      {toolbarActions.map((item, i) =>
        item === 'sep' ? (
          <div key={i} className="w-px h-4 bg-gray-200 mx-0.5" />
        ) : (
          <button
            key={item.title}
            type="button"
            title={item.title}
            onMouseDown={(e) => {
              e.preventDefault() // keep textarea focused
              handleAction(item.action)
            }}
            className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
          >
            <item.icon className="w-3 h-3" />
          </button>
        )
      )}
    </div>
  )
}

// Click-to-edit inline markdown field with WYSIWYG toolbar
// View mode: renders Markdown with heading # hover markers
// Edit mode: auto-growing textarea + toolbar; blur → back to view mode
export interface InlineMarkdownFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  readOnly?: boolean
}

export function InlineMarkdownField({
  value,
  onChange,
  placeholder = 'Clique para escrever…',
  className,
  readOnly = false,
}: InlineMarkdownFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync draft when value changes externally (e.g. parent reloads data)
  useEffect(() => {
    if (!isEditing) setDraft(value)
  }, [value, isEditing])

  // Auto-resize textarea
  useLayoutEffect(() => {
    if (isEditing && textareaRef.current) {
      const ta = textareaRef.current
      ta.style.height = 'auto'
      ta.style.height = ta.scrollHeight + 'px'
    }
  }, [isEditing, draft])

  function enterEdit() {
    if (readOnly) return
    setDraft(value)
    setIsEditing(true)
  }

  function handleBlur() {
    setIsEditing(false)
    if (draft !== value) onChange(draft)
  }

  if (!isEditing) {
    return (
      <div
        onClick={enterEdit}
        className={cn(
          'rounded-md transition-colors min-h-[2rem]',
          readOnly ? 'cursor-default' : 'cursor-text hover:bg-gray-50/80',
          className
        )}
      >
        {value.trim() ? (
          <InlineMarkdownRenderer content={value} />
        ) : !readOnly ? (
          <p className="text-gray-400 text-sm italic px-2 py-1.5">{placeholder}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('rounded-md border border-teal-300 bg-white overflow-hidden shadow-sm', className)}>
      <InlineMdToolbar value={draft} onChange={setDraft} textareaRef={textareaRef} />
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        autoFocus
        placeholder={placeholder}
        className="w-full resize-none p-3 text-sm font-mono text-gray-900 focus:outline-none leading-relaxed bg-white min-h-[5rem]"
        style={{ overflow: 'hidden' }}
      />
    </div>
  )
}
