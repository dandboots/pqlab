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
      // Zero outer margins so first-line Y=0 matches the textarea's py-0 — prevents visual jump on edit
      '[&>*:first-child]:!mt-0 [&>*:last-child]:!mb-0',
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
// AST-based contenteditable editor — Bear / Ulysses / Lexical model.
//
// Pipeline per keystroke:
//   onBeforeInput → preventDefault → applyChange(model) → setDoc → React render
//   → useLayoutEffect → restoreSelection(savedOffset)
//
// The DOM is a projection of the model, never the source of truth.
// Cursor is preserved via text-offset ↔ DOM-position mapping.
//
// INVARIANT: editorRef.current.textContent === docRef.current (always)

// ─── Selection utilities ──────────────────────────────────────────────────────

/** Save cursor/selection as linear text offsets (DOM-independent). */
function getSelectionOffsets(el: Element): { start: number; end: number } | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (!el.contains(range.startContainer)) return null
  const preStart = document.createRange()
  preStart.selectNodeContents(el)
  preStart.setEnd(range.startContainer, range.startOffset)
  const preEnd = document.createRange()
  preEnd.selectNodeContents(el)
  preEnd.setEnd(range.endContainer, range.endOffset)
  return { start: preStart.toString().length, end: preEnd.toString().length }
}

/** Walk text nodes to find the DOM node+offset for a given character index. */
function findDOMPos(el: Element, target: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let acc = 0
  let n: Node | null
  while ((n = walker.nextNode()) !== null) {
    const len = (n as Text).length
    if (acc + len >= target) return { node: n, offset: target - acc }
    acc += len
  }
  return { node: el, offset: el.childNodes.length }
}

/** Restore a saved { start, end } selection inside el. */
function restoreSelectionOffsets(el: Element, start: number, end: number) {
  const sel = window.getSelection()
  if (!sel) return
  const s = findDOMPos(el, start)
  const e = start === end ? s : findDOMPos(el, end)
  const r = document.createRange()
  r.setStart(s.node, s.offset)
  r.setEnd(e.node, e.offset)
  sel.removeAllRanges()
  sel.addRange(r)
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────
// Produces a flat array of { text, cls } segments.
// INVARIANT: segs.map(s => s.text).join('') === input text (always)

interface Seg { text: string; cls: string }

const INLINE_TOKEN_RE = /(\*\*[^*\n]+?\*\*|~~[^~\n]+?~~|\*[^*\n]+?\*|`[^`\n]+?`|\[\[[^\]\n]+?\]\]|\[[^\]\n]+?\]\([^)\n]+?\)|\bpp?\.\s*\d+(?:\s*[-–]\s*\d+)?\b|\(\d+\))/g

function tokenInline(text: string, base: string): Seg[] {
  const out: Seg[] = []
  INLINE_TOKEN_RE.lastIndex = 0
  let last = 0; let m: RegExpExecArray | null
  while ((m = INLINE_TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), cls: base })
    const s = m[0]
    if (s.startsWith('**') && s.length > 4) {
      out.push({ text: '**', cls: 'text-gray-300' })
      out.push({ text: s.slice(2, -2), cls: cn('font-semibold', base) })
      out.push({ text: '**', cls: 'text-gray-300' })
    } else if (s.startsWith('~~') && s.length > 4) {
      out.push({ text: '~~', cls: 'text-gray-300' })
      out.push({ text: s.slice(2, -2), cls: cn('line-through text-gray-400', base) })
      out.push({ text: '~~', cls: 'text-gray-300' })
    } else if (s.startsWith('*') && s.length > 2) {
      out.push({ text: '*', cls: 'text-gray-300' })
      out.push({ text: s.slice(1, -1), cls: cn('italic', base) })
      out.push({ text: '*', cls: 'text-gray-300' })
    } else if (s.startsWith('`') && s.length > 2) {
      out.push({ text: s, cls: 'font-mono text-xs text-gray-700 bg-gray-100 rounded px-0.5' })
    } else if (s.startsWith('[[')) {
      out.push({ text: '[[', cls: 'text-orange-300' })
      out.push({ text: s.slice(2, -2), cls: cn('text-orange-600 font-medium', base) })
      out.push({ text: ']]', cls: 'text-orange-300' })
    } else if (s.startsWith('[')) {
      out.push({ text: s, cls: cn('text-blue-600 underline', base) })
    } else {
      PAGE_PILL_RE.lastIndex = 0
      if (PAGE_PILL_RE.test(s)) {
        out.push({ text: s, cls: 'text-teal-600 bg-teal-50 border border-teal-200 rounded px-0.5 font-mono text-xs' })
      } else if (/^\(\d+\)$/.test(s)) {
        out.push({ text: s, cls: 'text-gray-600 bg-gray-100 border border-gray-300 rounded-full text-xs font-semibold px-0.5' })
      } else {
        out.push({ text: s, cls: base })
      }
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), cls: base })
  return out
}

function tokenLine(line: string): Seg[] {
  if (/^[-*_]{3,}$/.test(line.trim())) return [{ text: line, cls: 'text-gray-300' }]
  const h = line.match(/^(#{1,3}) (.+)$/)
  if (h) {
    const wt = h[1].length === 1 ? 'font-bold' : h[1].length === 2 ? 'font-semibold' : 'font-medium'
    return [{ text: h[1] + ' ', cls: 'text-gray-300 font-normal' }, ...tokenInline(h[2], cn(wt, 'text-gray-900'))]
  }
  if (line.startsWith('> ')) return [{ text: '> ', cls: 'text-gray-300' }, ...tokenInline(line.slice(2), 'italic text-gray-500')]
  const b = line.match(/^(\s*)([-*]) (.*)$/)
  if (b) return [...(b[1] ? [{ text: b[1], cls: '' }] : []), { text: b[2] + ' ', cls: 'text-gray-400' }, ...tokenInline(b[3], '')]
  const n = line.match(/^(\d+)\. (.*)$/)
  if (n) return [{ text: n[1] + '. ', cls: 'text-gray-400' }, ...tokenInline(n[2], '')]
  return tokenInline(line, '')
}

/** Full markdown → Seg[]. Invariant: segs.map(s=>s.text).join('')===text */
function tokenizeMD(text: string): Seg[] {
  if (!text) return []
  const lines = text.split('\n')
  const out: Seg[] = []
  lines.forEach((line, i) => {
    out.push(...tokenLine(line))
    if (i < lines.length - 1) out.push({ text: '\n', cls: '' })
  })
  return out
}

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
  // ── Model: text is the single source of truth ──────────────────────────────
  const [doc, setDoc] = useState(value)
  const docRef = useRef(value)          // always up-to-date, avoids stale closures
  const editorRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pendingSel = useRef<{ start: number; end: number } | null>(null)
  const [focused, setFocused] = useState(false)

  // ── Sync when parent changes value externally ──────────────────────────────
  useEffect(() => {
    if (!focused && value !== docRef.current) {
      docRef.current = value
      setDoc(value)
    }
  }, [value, focused])

  // ── After every React commit: restore pending cursor position ──────────────
  // useLayoutEffect fires synchronously before browser paint — user never sees jump.
  useLayoutEffect(() => {
    const sel = pendingSel.current
    const el = editorRef.current
    if (!sel || !el) return
    pendingSel.current = null
    restoreSelectionOffsets(el, sel.start, sel.end)
  })

  // ── Input pipeline: intercept → mutate model → restore selection ───────────
  function applyEdit(inputType: string, data: string | null, dataTransfer: DataTransfer | null) {
    const el = editorRef.current!
    const saved = getSelectionOffsets(el)
    if (!saved) return
    const { start, end } = saved
    const text = docRef.current
    let newText = text
    let cur = start

    switch (inputType) {
      case 'insertText': {
        const ch = data ?? ''
        const tentative = text.slice(0, start) + ch + text.slice(end)
        const pos = start + ch.length
        const tail = tentative.slice(Math.max(0, pos - 2), pos)
        if (tail === '->') { newText = tentative.slice(0, pos - 2) + '→' + tentative.slice(pos); cur = pos - 1 }
        else if (tail === '<-') { newText = tentative.slice(0, pos - 2) + '←' + tentative.slice(pos); cur = pos - 1 }
        else { newText = tentative; cur = pos }
        break
      }
      case 'insertLineBreak':
      case 'insertParagraph':
        newText = text.slice(0, start) + '\n' + text.slice(end); cur = start + 1
        break
      case 'deleteContentBackward':
        if (start !== end) { newText = text.slice(0, start) + text.slice(end); cur = start }
        else if (start > 0) {
          const prev = text[start - 1]
          if (prev === '→') { newText = text.slice(0, start - 1) + '->' + text.slice(start); cur = start + 1 }
          else if (prev === '←') { newText = text.slice(0, start - 1) + '<-' + text.slice(start); cur = start + 1 }
          else { newText = text.slice(0, start - 1) + text.slice(start); cur = start - 1 }
        }
        break
      case 'deleteContentForward':
        if (start !== end) { newText = text.slice(0, start) + text.slice(end); cur = start }
        else if (start < text.length) { newText = text.slice(0, start) + text.slice(start + 1); cur = start }
        break
      case 'deleteWordBackward': {
        const before = text.slice(0, start !== end ? start : start)
        const m = before.match(/\S+\s*$/)
        const del = start !== end ? 0 : (m ? m[0].length : 1)
        newText = text.slice(0, start - del) + text.slice(start !== end ? end : start)
        cur = start - del
        break
      }
      case 'deleteWordForward': {
        if (start !== end) { newText = text.slice(0, start) + text.slice(end); cur = start }
        else { const m = text.slice(start).match(/^\s*\S+/); const d = m ? m[0].length : 1; newText = text.slice(0, start) + text.slice(start + d); cur = start }
        break
      }
      case 'insertFromPaste': {
        const pasted = dataTransfer?.getData('text/plain') ?? data ?? ''
        newText = text.slice(0, start) + pasted + text.slice(end); cur = start + pasted.length
        break
      }
      default: return  // unhandled — let browser deal with it (copy, undo, etc.)
    }

    docRef.current = newText
    pendingSel.current = { start: cur, end: cur }
    setDoc(newText)
    if (newText !== text) onChange(newText)
  }

  function handleBeforeInput(e: React.FormEvent<HTMLDivElement>) {
    const ev = e.nativeEvent as InputEvent
    e.preventDefault()
    applyEdit(ev.inputType, ev.data, ev.dataTransfer)
  }

  // Fallback for browsers where paste doesn't fire onBeforeInput
  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text/plain')
    const el = editorRef.current!
    const saved = getSelectionOffsets(el)
    if (!saved) return
    const { start, end } = saved
    const newText = docRef.current.slice(0, start) + pasted + docRef.current.slice(end)
    docRef.current = newText
    pendingSel.current = { start: start + pasted.length, end: start + pasted.length }
    setDoc(newText)
    onChange(newText)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') editorRef.current?.blur()
  }

  // ── Toolbar integration via mock adapter ───────────────────────────────────
  // The existing InlineMdToolbar was built for <textarea>. We adapt it by
  // providing a proxy object that maps textarea API → contenteditable API.
  const toolbarAdapterRef = useRef<HTMLTextAreaElement | null>(null)
  if (!toolbarAdapterRef.current) {
    toolbarAdapterRef.current = {
      get value() { return docRef.current },
      get selectionStart() { return getSelectionOffsets(editorRef.current!)?.start ?? 0 },
      get selectionEnd() { return getSelectionOffsets(editorRef.current!)?.end ?? 0 },
      focus() { editorRef.current?.focus() },
      setSelectionRange(s: number, e_: number) {
        // Called in toolbar's setTimeout — DOM is already updated, restore directly
        requestAnimationFrame(() => {
          if (editorRef.current) restoreSelectionOffsets(editorRef.current, s, e_)
        })
      },
    } as unknown as HTMLTextAreaElement
  }
  const toolbarRef = { current: toolbarAdapterRef.current } as React.RefObject<HTMLTextAreaElement | null>

  function handleToolbarChange(newValue: string) {
    docRef.current = newValue
    setDoc(newValue)
    onChange(newValue)
    editorRef.current?.focus()
  }

  // ── Read-only: pretty rendered HTML ───────────────────────────────────────
  if (readOnly) {
    return (
      <div className={cn('min-h-[2rem]', className)}>
        {value.trim() ? <InlineMarkdownRenderer content={value} /> : null}
      </div>
    )
  }

  // ── Editable: contenteditable div with live syntax highlighting ────────────
  // The div IS the editing surface — cursor lives inside the styled spans.
  // The browser places the cursor naturally where the user clicks.
  // React re-renders inject the styled segments; useLayoutEffect restores cursor.
  const segs = tokenizeMD(doc)

  return (
    <div ref={containerRef} className={cn('relative text-sm leading-relaxed', className)}>
      {/* Floating toolbar */}
      {focused && (
        <div className="absolute right-0 z-20" style={{ bottom: '100%', marginBottom: '4px' }}>
          <InlineMdToolbar value={doc} onChange={handleToolbarChange} textareaRef={toolbarRef} />
        </div>
      )}

      {/* Placeholder — outside contenteditable so it's never part of textContent */}
      {!doc && (
        <span className="absolute top-0 left-5 pointer-events-none select-none text-gray-400 italic" aria-hidden>
          {placeholder}
        </span>
      )}

      {/* The editor itself */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onBeforeInput={handleBeforeInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (containerRef.current?.contains(e.relatedTarget as Node)) return
          setFocused(false)
          onChange(docRef.current)
        }}
        className="outline-none pl-5 pr-2 py-0 min-h-[2rem] whitespace-pre-wrap break-words text-gray-800"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        spellCheck={false}
      >
        {segs.map((seg, i) =>
          seg.cls
            ? <span key={i} className={seg.cls}>{seg.text}</span>
            : seg.text
        )}
      </div>
    </div>
  )
}
