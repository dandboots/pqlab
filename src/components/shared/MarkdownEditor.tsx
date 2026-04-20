import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
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

// ─── Inline text highlights — page pills & numbered topic pills ────────────────

// Matches: p. 90 | pp. 90 | pp. 90-92 | pp. 90–92 | p.90 etc.
const PAGE_PILL_RE = /\bpp?\.\s*\d+(?:\s*[-–]\s*\d+)?\b/g
// Matches: (1) (2) (14) etc.
const NUM_PILL_RE = /\(\d+\)/g
// Combined split regex
const HIGHLIGHT_SPLIT_RE = /(\bpp?\.\s*\d+(?:\s*[-–]\s*\d+)?\b|\(\d+\))/g

function highlightInlineText(text: string): React.ReactNode {
  const parts = text.split(HIGHLIGHT_SPLIT_RE)
  if (parts.length === 1) return text  // fast path — no match
  return parts.map((part, i) => {
    if (!part) return null
    // Page reference pill
    PAGE_PILL_RE.lastIndex = 0
    if (PAGE_PILL_RE.test(part)) {
      return (
        <span
          key={i}
          className="inline-flex items-center px-1.5 py-0 rounded text-xs font-mono bg-teal-50 border border-teal-200 text-teal-700 mx-0.5 select-none whitespace-nowrap"
        >
          {part}
        </span>
      )
    }
    // Numbered topic pill — (1), (2), etc.
    NUM_PILL_RE.lastIndex = 0
    if (NUM_PILL_RE.test(part)) {
      return (
        <span
          key={i}
          className="inline-flex items-center justify-center w-[1.3em] h-[1.3em] rounded-full text-xs font-semibold bg-gray-100 border border-gray-300 text-gray-700 mx-0.5 select-none"
        >
          {part.slice(1, -1)}
        </span>
      )
    }
    return part
  })
}

// Recursively applies inline highlights to ReactMarkdown children
function applyHighlights(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string') return highlightInlineText(children)
  if (Array.isArray(children)) return children.map((c, i) =>
    typeof c === 'string' ? <span key={i}>{highlightInlineText(c)}</span> : c
  )
  return children
}

// WikiMarkdown variant with heading hover and inline highlights
function InlineWikiMarkdown({ content }: { content: string }) {
  const { navigate } = useWikiLinks()
  const processed = processWikiLinks(content)
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        ...inlineHeadingComponents,
        p: ({ children }) => <p>{applyHighlights(children)}</p>,
        li: ({ children }) => <li>{applyHighlights(children)}</li>,
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
    <div className={cn(
      'prose prose-sm max-w-none pl-5 dark:prose-invert text-gray-800 leading-relaxed',
      '[&_p]:my-2 [&_p+p]:mt-3',  // generous paragraph spacing
      className
    )}>
      <InlineWikiMarkdown content={content} />
    </div>
  )
}

// ─── Inline toolbar ─────────────────────────────────────────────────────────
// Renders as a floating pill — absolutely positioned so it never affects layout.
// onMouseDown + preventDefault on every button + the wrapper keeps textarea focused.

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
    // position: absolute — caller places this div; it takes zero layout space.
    // onMouseDown on the wrapper catches clicks on padding between buttons.
    <div
      className="flex items-center gap-0.5 flex-wrap px-1 py-0.5 bg-white border border-gray-200 rounded-lg shadow-md"
      onMouseDown={(e) => e.preventDefault()}
    >
      {toolbarActions.map((item, i) =>
        item === 'sep' ? (
          <div key={i} className="w-px h-3.5 bg-gray-200 mx-0.5" />
        ) : (
          <button
            key={item.title}
            type="button"
            title={item.title}
            onMouseDown={(e) => {
              e.preventDefault() // keep textarea focused
              handleAction(item.action)
            }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <item.icon className="w-3 h-3" />
          </button>
        )
      )}
    </div>
  )
}

// ─── InlineMarkdownField ─────────────────────────────────────────────────────
// Click anywhere on the rendered text → edit directly with zero layout shift.
// The toolbar floats above the field via position:absolute, taking no space.
// Typing -> / <- converts to → / ←; Backspace restores the original two chars.
// Page refs (p. 90 / pp. 90-92) and topic numbers (1) appear as pills in view mode.

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
  const containerRef = useRef<HTMLDivElement>(null)
  // Captures click position for cursor placement on edit entry
  const clickCoordsRef = useRef<{ x: number; y: number } | null>(null)
  const justEnteredEdit = useRef(false)

  // Sync draft when value changes externally (e.g. parent reloads data)
  useEffect(() => {
    if (!isEditing) setDraft(value)
  }, [value, isEditing])

  // Auto-resize on every draft change
  useLayoutEffect(() => {
    if (!isEditing || !textareaRef.current) return
    const ta = textareaRef.current
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
  }, [isEditing, draft])

  // On first render in edit mode: focus WITHOUT scroll + place cursor at click position.
  // Everything here runs synchronously before the browser paints → zero visible jump.
  useLayoutEffect(() => {
    if (!isEditing || !justEnteredEdit.current || !textareaRef.current) return
    justEnteredEdit.current = false
    const ta = textareaRef.current
    const coords = clickCoordsRef.current
    clickCoordsRef.current = null

    // Resize first so getBoundingClientRect() returns the final geometry
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'

    // Focus without scrolling (prevents the page from jumping to position 0)
    ta.focus({ preventScroll: true })

    // Estimate which line/offset the user clicked and place cursor there
    let offset = ta.value.length  // fallback: end of text
    if (coords) {
      const taRect = ta.getBoundingClientRect()
      const relY = coords.y - taRect.top
      const style = getComputedStyle(ta)
      const lineHeight = parseFloat(style.lineHeight) || 20
      const paddingTop = parseFloat(style.paddingTop) || 0
      const lineIndex = Math.max(0, Math.floor((relY - paddingTop) / lineHeight))
      const lines = ta.value.split('\n')
      let lineOffset = 0
      for (let i = 0; i < Math.min(lineIndex, lines.length - 1); i++) {
        lineOffset += lines[i].length + 1  // +1 for \n
      }
      offset = lineOffset + (lines[Math.min(lineIndex, lines.length - 1)] ?? '').length
    }
    ta.setSelectionRange(Math.min(offset, ta.value.length), Math.min(offset, ta.value.length))
  }, [isEditing])

  function enterEdit(e: React.MouseEvent) {
    if (readOnly) return
    clickCoordsRef.current = { x: e.clientX, y: e.clientY }
    justEnteredEdit.current = true
    setDraft(value)
    setIsEditing(true)
  }

  // Only leave edit mode when focus moves outside both the textarea AND the toolbar
  function handleBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return
    setIsEditing(false)
    if (draft !== value) onChange(draft)
  }

  // Auto-replace -> with → and <- with ← as the user types
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    const pos = e.target.selectionStart
    if (pos >= 2) {
      const tail = val.slice(pos - 2, pos)
      let arrow: string | null = null
      if (tail === '->') arrow = '→'
      if (tail === '<-') arrow = '←'
      if (arrow) {
        const next = val.slice(0, pos - 2) + arrow + val.slice(pos)
        setDraft(next)
        requestAnimationFrame(() => {
          textareaRef.current?.setSelectionRange(pos - 1, pos - 1)
        })
        return
      }
    }
    setDraft(val)
  }

  // Backspace on → restores ->; Backspace on ← restores <-
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Backspace') return
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart: pos, selectionEnd: end } = ta
    if (pos !== end || pos === 0) return  // selection or start-of-field — default behaviour
    const prev = draft[pos - 1]
    if (prev === '→') {
      e.preventDefault()
      const next = draft.slice(0, pos - 1) + '->' + draft.slice(pos)
      setDraft(next)
      requestAnimationFrame(() => ta.setSelectionRange(pos + 1, pos + 1))
    } else if (prev === '←') {
      e.preventDefault()
      const next = draft.slice(0, pos - 1) + '<-' + draft.slice(pos)
      setDraft(next)
      requestAnimationFrame(() => ta.setSelectionRange(pos + 1, pos + 1))
    }
  }

  // ── View mode ──────────────────────────────────────────────────────────────
  if (!isEditing) {
    return (
      <div
        onClick={enterEdit}
        className={cn(
          'min-h-[2rem]',
          readOnly ? 'cursor-default' : 'cursor-text',
          className
        )}
      >
        {value.trim() ? (
          <InlineMarkdownRenderer content={value} />
        ) : !readOnly ? (
          <p className="text-gray-400 text-sm italic pl-5 py-1">{placeholder}</p>
        ) : null}
      </div>
    )
  }

  // ── Edit mode — truly seamless ─────────────────────────────────────────────
  // The toolbar uses position:absolute with bottom:100% so it floats ABOVE the
  // field without adding any height to the container → zero layout shift.
  // The textarea is styled identically to the rendered prose view:
  //   same font-sans, same pl-5, same text-sm leading-relaxed, bg-transparent.
  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Floating toolbar — above the field, outside normal flow (no layout shift) */}
      <div
        className="absolute right-0 z-20"
        style={{ bottom: '100%', marginBottom: '4px' }}
      >
        <InlineMdToolbar value={draft} onChange={setDraft} textareaRef={textareaRef} />
      </div>
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-full resize-none pl-5 pr-2 py-0 bg-transparent border-0 outline-none ring-0 focus:ring-0 min-h-[2rem] placeholder:text-gray-400 placeholder:italic"
        style={{ overflow: 'hidden', font: 'inherit', color: 'inherit', lineHeight: 'inherit' }}
      />
    </div>
  )
}
