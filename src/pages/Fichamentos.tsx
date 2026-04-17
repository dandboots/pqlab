import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import { FileText, Table2, Plus, Search, Edit2, Trash2, Download, ExternalLink, BookOpen, LayoutGrid, List as ListIcon, X, ChevronDown, ChevronUp, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToastContainer } from '@/components/ui/toast'
import { InlineMarkdownField } from '@/components/shared/MarkdownEditor'
import { useAuth } from '@/contexts/AuthContext'
import { useWikiLinks, extractWikiLinks } from '@/contexts/WikiLinkContext'
import { useToast } from '@/hooks/useToast'
import { loadFichamentos, saveFichamento, deleteFichamento, uploadAnexo } from '@/lib/storage'
import { formatDate } from '@/lib/utils'
import type { Fichamento, FichamentoSubEntry, Anexo } from '@/types'

// ─── Demo data ────────────────────────────────────────────────────────────

const DEMO: Fichamento[] = [
  {
    id: '1', title: 'A Imaginação Sociológica', authors: ['C. Wright Mills'], year: 1959, journal: 'Oxford University Press',
    doi: undefined, url: undefined, attachment: undefined,
    summary: '## Ideia central\n\nMills argumenta que a imaginação sociológica é a capacidade de compreender as relações entre biografia pessoal e história social mais ampla.\n\n**Conceito-chave:** A distinção entre *inquietações pessoais* e *questões públicas*.',
    subEntries: [
      { id: 's1', pages: 'p. 3', content: '"A imaginação sociológica permite a seu possuidor compreender o cenário histórico mais amplo em termos de seu significado para a vida íntima e para a carreira exterior de numerosos indivíduos."' },
      { id: 's2', pages: 'pp. 12-13', content: 'Distinção entre "troubles" (problemas pessoais de âmbito privado) e "issues" (questões públicas de âmbito social).' },
    ],
    created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z',
  },
]

// ─── Reference formatting ──────────────────────────────────────────────────

function formatABNT(f: Fichamento): string {
  const authors = f.authors.length > 0
    ? f.authors.map((a) => {
        const parts = a.split(' ')
        const last = parts.pop() ?? ''
        return `${last.toUpperCase()}, ${parts.join(' ')}`
      }).join('; ')
    : 'AUTOR DESCONHECIDO'
  const doi = f.doi ? `. DOI: ${f.doi}` : ''
  return `${authors}. **${f.title}**. ${f.journal ?? ''}${f.year ? `, ${f.year}` : ''}${doi}.`
}

function formatAPA(f: Fichamento): string {
  const authors = f.authors.length > 0
    ? f.authors.map((a) => {
        const parts = a.split(' ')
        const last = parts.pop() ?? ''
        const initials = parts.map((p) => p[0] + '.').join(' ')
        return `${last}, ${initials}`
      }).join(', ')
    : 'Autor Desconhecido'
  const doi = f.doi ? ` https://doi.org/${f.doi}` : ''
  return `${authors} (${f.year ?? 's.d.'}). *${f.title}*. ${f.journal ?? ''}${doi}`
}

// ─── Export helpers ────────────────────────────────────────────────────────

function exportFichamentoMarkdown(f: Fichamento) {
  const ref = formatABNT(f)
  const subMd = f.subEntries.map((s) => `| ${s.pages} | ${s.content.replace(/\n/g, ' ')} |`).join('\n')
  const md = `# ${f.title}\n\n## Referência\n\n${ref}\n\n## Resumo\n\n${f.summary}\n\n## Anotações\n\n| Página(s) | Ideia / Citação |\n|-----------|---|\n${subMd}`
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `fichamento-${f.id}.md`; a.click(); URL.revokeObjectURL(url)
}

function exportFichamentoPDF(f: Fichamento) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 20
  const pageWidth = 210
  const pageHeight = 297
  const contentWidth = pageWidth - margin * 2

  // ── Header (no background) ────────────────────────────────────────────────
  let y = 22

  // Small "Fichamento" label in green
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(22, 163, 74)
  doc.text('Fichamento', margin, y)
  y += 7

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(15, 15, 15)
  const titleLines = doc.splitTextToSize(f.title, contentWidth)
  doc.text(titleLines, margin, y)
  y += titleLines.length * 7 + 3

  // Authors + year
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  const authorStr = f.authors.join(', ') + (f.year ? ` (${f.year})` : '')
  doc.text(authorStr, margin, y)
  y += 6

  // Short green accent line
  doc.setDrawColor(22, 163, 74)
  doc.setLineWidth(0.8)
  doc.line(margin, y, margin + 40, y)
  y += 8

  // ── Metadata row ──────────────────────────────────────────────────────────
  const metaPairs: Array<[string, string]> = []
  if (f.journal) metaPairs.push(['Periódico / Livro', f.journal])
  if (f.doi) metaPairs.push(['DOI', f.doi])
  if (metaPairs.length > 0) {
    let xPos = margin
    for (const [label, value] of metaPairs) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(140, 140, 140)
      doc.text(label, xPos, y)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(30, 30, 30)
      const shortValue = value.length > 55 ? value.slice(0, 52) + '...' : value
      doc.text(shortValue, xPos, y + 4.5)
      xPos += 95
    }
    y += 12
  }

  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // ── Resumo ────────────────────────────────────────────────────────────────
  if (f.summary) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(22, 163, 74)
    doc.text('RESUMO', margin, y)
    y += 6

    const plain = f.summary
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^[-*]\s+/gm, '• ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim()

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(50, 50, 50)
    const summaryLines = doc.splitTextToSize(plain, contentWidth)
    if (y + summaryLines.length * 4.5 > 270) { doc.addPage(); y = 20 }
    doc.text(summaryLines, margin, y)
    y += summaryLines.length * 4.5 + 8
  }

  // ── Anotações ─────────────────────────────────────────────────────────────
  if (f.subEntries.length > 0) {
    if (y > 250) { doc.addPage(); y = 20 }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(22, 163, 74)
    doc.text('ANOTAÇÕES', margin, y)
    y += 7

    f.subEntries.forEach((entry, idx) => {
      if (y > 265) { doc.addPage(); y = 20 }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(22, 163, 74)
      doc.text(`${idx + 1}.  [${entry.pages}]`, margin, y)
      y += 5

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(50, 50, 50)
      const contentLines = doc.splitTextToSize(entry.content, contentWidth - 6)
      if (y + contentLines.length * 4.5 > 272) { doc.addPage(); y = 20 }
      doc.text(contentLines, margin + 4, y)
      y += contentLines.length * 4.5 + 5

      if (idx < f.subEntries.length - 1) {
        doc.setDrawColor(240, 240, 240)
        doc.setLineWidth(0.15)
        doc.line(margin, y - 2, pageWidth - margin, y - 2)
      }
    })
    y += 3
  }

  // ── ABNT reference at bottom ──────────────────────────────────────────────
  if (y + 18 > pageHeight - 15) { doc.addPage(); y = 20 }
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(150, 150, 150)
  doc.text('Referência (ABNT)', margin, y)
  y += 5
  const abnt = formatABNT(f).replace(/\*\*/g, '')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(120, 120, 120)
  const abntLines = doc.splitTextToSize(abnt, contentWidth)
  doc.text(abntLines, margin, y)

  // ── Page numbers ──────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  if (totalPages > 1) {
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(180, 180, 180)
      doc.text(`${i} / ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
    }
  }

  doc.save(`fichamento-${f.id}.pdf`)
}

function exportAllXLS(fichamentos: Fichamento[]) {
  const wb = XLSX.utils.book_new()
  const rows = fichamentos.map((f) => ({
    Título: f.title, Autores: f.authors.join('; '), Ano: f.year ?? '', Journal: f.journal ?? '', DOI: f.doi ?? '',
    Resumo: f.summary.replace(/[#*_~`>]/g, '').slice(0, 300),
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Fichamentos')
  const subRows = fichamentos.flatMap((f) => f.subEntries.map((s) => ({ Fichamento: f.title, Páginas: s.pages, Conteúdo: s.content })))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(subRows), 'Entradas')
  XLSX.writeFile(wb, 'fichamentos.xlsx')
}

function exportAllCSV(fichamentos: Fichamento[]) {
  const rows = fichamentos.map((f) => [f.title, f.authors.join('; '), f.year ?? '', f.journal ?? '', f.doi ?? ''].join('\t'))
  const csv = ['Título\tAutores\tAno\tJournal\tDOI', ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'fichamentos.csv'; a.click(); URL.revokeObjectURL(url)
}

// ─── Fichamento form dialog ────────────────────────────────────────────────

interface FichamentoFormProps {
  open: boolean
  onClose: () => void
  onSave: (f: Fichamento) => void
  initial?: Fichamento
  isDemoMode: boolean
}

function FichamentoForm({ open, onClose, onSave, initial, isDemoMode }: FichamentoFormProps) {
  const id = useRef(initial?.id ?? crypto.randomUUID()).current
  const [title, setTitle] = useState(initial?.title ?? '')
  const [authorsInput, setAuthorsInput] = useState((initial?.authors ?? []).join('; '))
  const [year, setYear] = useState(initial?.year?.toString() ?? '')
  const [journal, setJournal] = useState(initial?.journal ?? '')
  const [doi, setDoi] = useState(initial?.doi ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [attachment, setAttachment] = useState<Anexo | undefined>(initial?.attachment)
  const [fetching, setFetching] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [manualMeta, setManualMeta] = useState<boolean>(!!initial)

  useEffect(() => {
    if (open) {
      const newId = crypto.randomUUID()
      Object.assign(id, { current: initial?.id ?? newId })
      setTitle(initial?.title ?? '')
      setAuthorsInput((initial?.authors ?? []).join('; '))
      setYear(initial?.year?.toString() ?? '')
      setJournal(initial?.journal ?? '')
      setDoi(initial?.doi ?? '')
      setUrl(initial?.url ?? '')
      setAttachment(initial?.attachment)
      setManualMeta(!!initial)
    }
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchMetadata() {
    if (doi) {
      setFetching(true)
      try {
        const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, { signal: AbortSignal.timeout(8000) })
        const data = await res.json() as { message?: { title?: string[]; author?: Array<{ given?: string; family?: string }>; 'published-print'?: { 'date-parts'?: number[][] }; 'container-title'?: string[]; publisher?: string } }
        const msg = data.message ?? {}
        if (msg.title?.[0]) setTitle(msg.title[0])
        if (msg.author?.length) {
          setAuthorsInput(msg.author.map((a) => `${a.given ?? ''} ${a.family ?? ''}`.trim()).join('; '))
        }
        if (msg['published-print']?.['date-parts']?.[0]?.[0]) {
          setYear(String(msg['published-print']['date-parts'][0][0]))
        }
        if (msg['container-title']?.[0]) setJournal(msg['container-title'][0])
        else if (msg.publisher) setJournal(msg.publisher)
        setManualMeta(true)
      } catch {
        setManualMeta(true)
      } finally {
        setFetching(false)
      }
    } else if (url) {
      setManualMeta(true)
    }
  }

  async function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (isDemoMode) {
      setAttachment({ id: crypto.randomUUID(), name: file.name, size: file.size, type: file.type, path: '', url: URL.createObjectURL(file) })
      e.target.value = ''; return
    }
    setUploading(true)
    try {
      const a = await uploadAnexo('fichamentos', id, file)
      setAttachment(a)
    } finally { setUploading(false); e.target.value = '' }
  }

  function handleSubmit() {
    if (!title.trim()) return
    const now = new Date().toISOString()
    onSave({
      id,
      title: title.trim(),
      authors: authorsInput.split(';').map((a) => a.trim()).filter(Boolean),
      year: year ? parseInt(year) : undefined,
      journal: journal || undefined,
      doi: doi || undefined,
      url: url || undefined,
      attachment,
      summary: initial?.summary ?? '',
      subEntries: initial?.subEntries ?? [],
      created_at: initial?.created_at ?? now,
      updated_at: now,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar fichamento' : 'Novo fichamento'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Source identification */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-semibold text-gray-700">Identificação da fonte</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fich-doi">DOI</Label>
                <div className="flex gap-2">
                  <Input id="fich-doi" value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="10.xxxx/xxxxx" className="font-mono text-sm flex-1" />
                  <Button type="button" variant="outline" size="sm" onClick={fetchMetadata} disabled={(!doi && !url) || fetching}>
                    {fetching ? '...' : 'Auto'}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fich-url">URL (alternativo ao DOI)</Label>
                <Input id="fich-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label>PDF anexo</Label>
                {attachment && <span className="text-xs text-green-600">{attachment.name}</span>}
              </div>
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileAttach} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Paperclip className="w-3.5 h-3.5" />
                  {uploading ? 'Enviando...' : 'Anexar PDF'}
                </Button>
                {attachment && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAttachment(undefined)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Manual metadata (shown when auto failed or user opens it) */}
          <div className="space-y-3">
            <button type="button" onClick={() => setManualMeta(!manualMeta)} className="text-sm text-green-600 hover:underline flex items-center gap-1">
              {manualMeta ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {manualMeta ? 'Ocultar metadados' : 'Inserir / editar metadados manualmente'}
            </button>
            {manualMeta && (
              <div className="space-y-3 p-4 border border-gray-200 rounded-lg">
                <div className="space-y-1.5">
                  <Label htmlFor="fich-title">Título *</Label>
                  <Input id="fich-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do texto" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fich-authors">Autores (separados por ;)</Label>
                    <Input id="fich-authors" value={authorsInput} onChange={(e) => setAuthorsInput(e.target.value)} placeholder="Nome Sobrenome; Outro Autor" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fich-year">Ano</Label>
                    <Input id="fich-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fich-journal">Periódico / Livro</Label>
                  <Input id="fich-journal" value={journal} onChange={(e) => setJournal(e.target.value)} placeholder="Nome do periódico, livro ou editora" />
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 italic">Após salvar, o resumo e as anotações podem ser editados diretamente no card.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>
            {initial ? 'Salvar' : 'Criar fichamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Reference display ─────────────────────────────────────────────────────

function ReferenceBlock({ fichamento, format }: { fichamento: Fichamento; format: 'abnt' | 'apa' | 'tabela' }) {
  if (format === 'tabela') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
          <tbody className="divide-y divide-gray-100">
            {fichamento.title && <tr><td className="px-3 py-1.5 text-gray-500 font-medium w-24">Título</td><td className="px-3 py-1.5 text-gray-800">{fichamento.title}</td></tr>}
            {fichamento.authors.length > 0 && <tr><td className="px-3 py-1.5 text-gray-500 font-medium">Autores</td><td className="px-3 py-1.5 text-gray-800">{fichamento.authors.join('; ')}</td></tr>}
            {fichamento.year && <tr><td className="px-3 py-1.5 text-gray-500 font-medium">Ano</td><td className="px-3 py-1.5 text-gray-800">{fichamento.year}</td></tr>}
            {fichamento.journal && <tr><td className="px-3 py-1.5 text-gray-500 font-medium">Periódico/Livro</td><td className="px-3 py-1.5 text-gray-800">{fichamento.journal}</td></tr>}
            {fichamento.doi && <tr><td className="px-3 py-1.5 text-gray-500 font-medium">DOI</td><td className="px-3 py-1.5 text-gray-800"><a href={`https://doi.org/${fichamento.doi}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{fichamento.doi}</a></td></tr>}
          </tbody>
        </table>
      </div>
    )
  }
  const text = format === 'abnt' ? formatABNT(fichamento) : formatAPA(fichamento)
  return (
    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200 leading-relaxed">
      <span dangerouslySetInnerHTML={{ __html: text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') }} />
    </p>
  )
}

// ─── Fichamento card ────────────────────────────────────────────────────────

function FichamentoCard({ f, refFormat, onEdit, onDelete, onUpdate, isDemoMode, defaultExpanded = false }: {
  f: Fichamento
  refFormat: 'abnt' | 'apa' | 'tabela'
  onEdit: () => void
  onDelete: () => void
  onUpdate: (updated: Fichamento) => void
  isDemoMode: boolean
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [data, setData] = useState(f)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [newPages, setNewPages] = useState('')
  const [newContent, setNewContent] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Sync external changes (e.g. metadata edits)
  useEffect(() => { setData(f) }, [f])

  const triggerSave = useCallback((updated: Fichamento) => {
    setSaveStatus('unsaved')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        if (!isDemoMode) await saveFichamento(updated)
        onUpdate(updated)
        setSaveStatus('saved')
      } catch {
        setSaveStatus('unsaved')
      }
    }, 1500)
  }, [isDemoMode, onUpdate])

  function updateContent(updated: Fichamento) {
    setData(updated)
    triggerSave(updated)
  }

  function addSubEntry() {
    if (!newPages.trim() || !newContent.trim()) return
    const entry = { id: crypto.randomUUID(), pages: newPages.trim(), content: newContent.trim() }
    const updated = { ...data, subEntries: [...data.subEntries, entry] }
    setNewPages(''); setNewContent('')
    updateContent(updated)
  }

  function removeSubEntry(idx: number) {
    updateContent({ ...data, subEntries: data.subEntries.filter((_, i) => i !== idx) })
  }

  function updateSubEntry(idx: number, patch: Partial<FichamentoSubEntry>) {
    const entries = data.subEntries.map((s, i) => i === idx ? { ...s, ...patch } : s)
    updateContent({ ...data, subEntries: entries })
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <BookOpen className="w-4 h-4 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 leading-snug">{data.title}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {data.authors.join(', ')}{data.year ? ` (${data.year})` : ''}{data.journal ? ` · ${data.journal}` : ''}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-gray-400">{formatDate(data.created_at.split('T')[0])}</span>
              {data.doi && (
                <a href={`https://doi.org/${data.doi}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                  <ExternalLink className="w-3 h-3" /> DOI
                </a>
              )}
              {data.subEntries.length > 0 && (
                <Badge variant="secondary" className="text-xs">{data.subEntries.length} anotaç{data.subEntries.length > 1 ? 'ões' : 'ão'}</Badge>
              )}
            </div>

            {expanded && (
              <div className="mt-4 space-y-5">
                {/* Auto-save indicator */}
                <div className="flex justify-end">
                  <span className={`text-xs select-none transition-opacity ${saveStatus === 'saved' ? 'text-gray-300' : saveStatus === 'saving' ? 'text-gray-400' : 'text-amber-500'}`}>
                    {saveStatus === 'saving' ? 'Salvando…' : saveStatus === 'unsaved' ? '● Não salvo' : '✓ Salvo'}
                  </span>
                </div>

                <ReferenceBlock fichamento={data} format={refFormat} />

                {/* Resumo — inline editable */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Resumo / Notas gerais</p>
                  <InlineMarkdownField
                    value={data.summary}
                    onChange={(v) => updateContent({ ...data, summary: v })}
                    placeholder="Clique para escrever o resumo e anotações…"
                  />
                </div>

                {/* Anotações — inline editable */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Anotações</p>
                  {data.subEntries.length > 0 && (
                    <div className="overflow-x-auto mb-3">
                      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">Página(s)</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-600">Ideia / Citação</th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {data.subEntries.map((s, i) => (
                            <tr key={s.id} className="align-top">
                              <td className="px-3 py-2">
                                <input
                                  value={s.pages}
                                  onChange={(e) => updateSubEntry(i, { pages: e.target.value })}
                                  className="w-full text-xs font-mono text-gray-500 bg-transparent focus:outline-none focus:bg-white focus:border focus:border-teal-300 rounded px-1"
                                  placeholder="p. 12"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <AutoResizeTextarea
                                  value={s.content}
                                  onChange={(v) => updateSubEntry(i, { content: v })}
                                  placeholder="Ideia ou citação…"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <button onClick={() => removeSubEntry(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {/* Add new sub-entry */}
                  <div className="flex gap-2 items-start">
                    <Input
                      value={newPages}
                      onChange={(e) => setNewPages(e.target.value)}
                      placeholder="p. 12"
                      className="h-8 text-xs w-24 flex-shrink-0"
                    />
                    <textarea
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      placeholder="Nova ideia ou citação… (Ctrl+Enter para adicionar)"
                      rows={2}
                      className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                      onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); addSubEntry() } }}
                    />
                    <button
                      onClick={addSubEntry}
                      disabled={!newPages.trim() || !newContent.trim()}
                      className="h-8 px-2 rounded-md border border-gray-200 text-gray-500 hover:bg-green-50 hover:text-green-600 hover:border-green-300 disabled:opacity-40 transition-colors flex-shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 ml-2 shrink-0">
            <button onClick={() => exportFichamentoMarkdown(data)} title="Exportar .md" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
              <FileText className="w-4 h-4" />
            </button>
            <button onClick={() => exportFichamentoPDF(data)} title="Exportar PDF" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={onEdit} title="Editar metadados" className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Auto-resizing plain textarea for sub-entry content
function AutoResizeTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    if (ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = ref.current.scrollHeight + 'px' }
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className="w-full text-sm text-gray-800 bg-transparent focus:outline-none focus:bg-white focus:border focus:border-teal-300 rounded px-1 py-0.5 resize-none overflow-hidden"
      style={{ minHeight: '1.5rem' }}
    />
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export function Fichamentos() {
  const { isDemoMode } = useAuth()
  const { toasts, toast, dismiss } = useToast()
  const { register } = useWikiLinks()
  const [fichamentos, setFichamentos] = useState<Fichamento[]>(isDemoMode ? DEMO : [])
  const [loading, setLoading] = useState(!isDemoMode)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list')
  const [refFormat, setRefFormat] = useState<'abnt' | 'apa' | 'tabela'>('abnt')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Fichamento | undefined>()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) return
    loadFichamentos()
      .then((data) => { setFichamentos(data); setLoading(false) })
      .catch((err: Error) => {
        toast({ title: 'Erro ao carregar', description: err.message, variant: 'destructive' })
        setLoading(false)
      })
  }, [isDemoMode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    register(fichamentos.map((f) => ({
      id: f.id, title: f.title, route: '/fichamentos',
      module: 'fichamentos' as const,
      wikiLinks: [
        ...extractWikiLinks(f.summary),
        ...f.subEntries.flatMap((s) => extractWikiLinks(s.content)),
      ],
    })))
  }, [fichamentos, register])

  const filtered = fichamentos.filter((f) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      f.title.toLowerCase().includes(q) ||
      f.authors.some((a) => a.toLowerCase().includes(q)) ||
      (f.journal ?? '').toLowerCase().includes(q) ||
      f.summary.toLowerCase().includes(q)
    )
  })

  async function handleSave(f: Fichamento) {
    if (!isDemoMode) {
      try { await saveFichamento(f) } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        toast({ title: 'Erro ao salvar', description: msg, variant: 'destructive' }); return
      }
    }
    const isNew = !editing
    setFichamentos((prev) => {
      const idx = prev.findIndex((x) => x.id === f.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = f; return next }
      return [f, ...prev]
    })
    if (isNew) setExpandedId(f.id)
    setFormOpen(false); setEditing(undefined)
    toast({ title: editing ? 'Fichamento atualizado' : 'Fichamento criado' })
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este fichamento?')) return
    if (!isDemoMode) {
      try { await deleteFichamento(id) } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        toast({ title: 'Erro ao excluir', description: msg, variant: 'destructive' }); return
      }
    }
    setFichamentos((prev) => prev.filter((f) => f.id !== id))
    toast({ title: 'Fichamento excluído' })
  }

  return (
    <div className="animate-fade-in space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Fichamentos</h1>
            <p className="text-sm text-gray-500">{fichamentos.length} texto{fichamentos.length !== 1 ? 's' : ''} fichado{fichamentos.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => exportAllXLS(filtered)}>
            <Table2 className="w-4 h-4" /> XLS
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportAllCSV(filtered)}>
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button onClick={() => { setEditing(undefined); setFormOpen(true) }}>
            <Plus className="w-4 h-4" /> Novo fichamento
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título, autor, periódico..." className="pl-9" />
        </div>
        <Select value={refFormat} onValueChange={(v) => setRefFormat(v as 'abnt' | 'apa' | 'tabela')}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="abnt">ABNT</SelectItem>
            <SelectItem value="apa">APA</SelectItem>
            <SelectItem value="tabela">Tabela</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border border-gray-200 rounded-md overflow-hidden">
          <button onClick={() => setViewMode('list')} className={`px-2.5 py-1.5 transition-colors ${viewMode === 'list' ? 'bg-green-50 text-green-600' : 'text-gray-500 hover:bg-gray-50'}`}>
            <ListIcon className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('cards')} className={`px-2.5 py-1.5 transition-colors ${viewMode === 'cards' ? 'bg-green-50 text-green-600' : 'text-gray-500 hover:bg-gray-50'}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search ? 'Nenhum resultado.' : 'Nenhum fichamento ainda. Crie o primeiro!'}</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {filtered.map((f) => (
            <FichamentoCard key={f.id} f={f} refFormat={refFormat}
              onEdit={() => { setEditing(f); setFormOpen(true) }}
              onDelete={() => handleDelete(f.id)}
              onUpdate={(upd) => setFichamentos((prev) => prev.map((x) => x.id === upd.id ? upd : x))}
              isDemoMode={isDemoMode}
              defaultExpanded={expandedId === f.id}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((f) => (
            <FichamentoCard key={f.id} f={f} refFormat={refFormat}
              onEdit={() => { setEditing(f); setFormOpen(true) }}
              onDelete={() => handleDelete(f.id)}
              onUpdate={(upd) => setFichamentos((prev) => prev.map((x) => x.id === upd.id ? upd : x))}
              isDemoMode={isDemoMode}
              defaultExpanded={expandedId === f.id}
            />
          ))}
        </div>
      )}

      <FichamentoForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(undefined) }}
        onSave={handleSave}
        initial={editing}
        isDemoMode={isDemoMode}
      />
    </div>
  )
}

