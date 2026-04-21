import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import jsPDF from 'jspdf'
import { load as yamlLoad } from 'js-yaml'
import {
  Document, Paragraph, TextRun, HeadingLevel, Packer,
  Table, TableRow, TableCell, WidthType,
} from 'docx'
import {
  ClipboardCheck, Plus, Edit2, Trash2, Download, FileText,
  ChevronDown, ChevronUp, X, Search,
  Calendar, Users, BookOpen, ArrowUpDown, ArrowUp, ArrowDown, Upload,
  CheckCircle2, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToastContainer } from '@/components/ui/toast'
import { InlineMarkdownField } from '@/components/shared/MarkdownEditor'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/useToast'
import { loadRevisoes, saveRevisao, deleteRevisao } from '@/lib/storage'
import { formatDate } from '@/lib/utils'
import type { Arguicao, Parecer, Revisao, TipoBanca, ModalidadeBanca } from '@/types'

// ─── Demo data ─────────────────────────────────────────────────────────────

const DEMO: Revisao[] = [
  {
    id: '1', subtype: 'arguicao',
    titulo: 'Memória, identidade e resistência: trajetórias de mulheres quilombolas no Baixo Amazonas',
    autor: 'Ana Clara Ferreira Lima',
    instituicao: 'UFPA - Universidade Federal do Pará',
    orientador: 'Prof. Dr. Carlos Eduardo Moreira',
    bancaMembers: ['Profa. Dra. Silvia Rodrigues (UFAM)', 'Prof. Dr. Marcos Antônio Souza (UEPA)'],
    tipoBanca: 'mestrado-academico', modalidade: 'defesa',
    data: '2026-03-20',
    comentariosGerais: 'Trabalho consistente e bem estruturado. A dissertação demonstra domínio da literatura sobre memória coletiva e identidade territorial. Ver pp. 23-25 para a fundamentação teórica principal.',
    questoesTeoricas: 'O diálogo com Halbwachs está bem articulado (p. 34), mas falta aprofundar a distinção entre memória individual e coletiva. Sugiro revisitar pp. 45-48.',
    questoesMetodologicas: 'A metodologia de história oral está adequada. Recomendo maior detalhamento dos critérios de seleção das interlocutoras — ver pp. 78-80.',
    comentariosEspecificos: 'Capítulo 3 (pp. 102-130) é o ponto alto do trabalho. A análise das narrativas é rica e bem conduzida.',
    conclusoes: 'Recomendo a aprovação com pequenas correções. O trabalho tem qualidade e originalidade.',
    anotacaoOutrosMembros: 'Profa. Silvia destacou a relevância metodológica da abordagem (p. 15). Prof. Marcos sugeriu ajuste na conclusão.',
    created_at: '2026-03-20T14:00:00Z', updated_at: '2026-03-20T14:00:00Z',
  },
  {
    id: '2', subtype: 'parecer',
    titulo: 'Redes sociais digitais e a reconfiguração das práticas de leitura acadêmica',
    solicitante: 'Revista Brasileira de Ciências da Comunicação (RBCC)',
    data: '2026-03-15',
    parecer: 'O artigo aborda tema relevante e atual. A revisão de literatura é abrangente (pp. 3-7), mas a seção metodológica carece de maior precisão (pp. 8-9). Os resultados são interessantes, especialmente o quadro comparativo em p. 12. Recomendo revisão antes de publicação.',
    created_at: '2026-03-15T10:00:00Z', updated_at: '2026-03-15T10:00:00Z',
  },
]

// ─── Institutions list ─────────────────────────────────────────────────────

const INSTITUICOES_BRASIL = [
  // Federais
  'UnB - Universidade de Brasília',
  'UFABC - Universidade Federal do ABC',
  'UFBA - Universidade Federal da Bahia',
  'UFC - Universidade Federal do Ceará',
  'UFES - Universidade Federal do Espírito Santo',
  'UFG - Universidade Federal de Goiás',
  'UFMA - Universidade Federal do Maranhão',
  'UFMG - Universidade Federal de Minas Gerais',
  'UFMT - Universidade Federal do Mato Grosso',
  'UFMS - Universidade Federal do Mato Grosso do Sul',
  'UFPA - Universidade Federal do Pará',
  'UFPB - Universidade Federal da Paraíba',
  'UFPel - Universidade Federal de Pelotas',
  'UFPE - Universidade Federal de Pernambuco',
  'UFPI - Universidade Federal do Piauí',
  'UFPR - Universidade Federal do Paraná',
  'UFRJ - Universidade Federal do Rio de Janeiro',
  'UFRN - Universidade Federal do Rio Grande do Norte',
  'UFRGS - Universidade Federal do Rio Grande do Sul',
  'UNIR - Universidade Federal de Rondônia',
  'UFRR - Universidade Federal de Roraima',
  'UFSC - Universidade Federal de Santa Catarina',
  'UFSM - Universidade Federal de Santa Maria',
  'UFSCar - Universidade Federal de São Carlos',
  'UNIFESP - Universidade Federal de São Paulo',
  'UFS - Universidade Federal de Sergipe',
  'UFT - Universidade Federal do Tocantins',
  'UNILA - Universidade Federal da Integração Latino-Americana',
  'UFFS - Universidade Federal da Fronteira Sul',
  'UFRB - Universidade Federal do Recôncavo da Bahia',
  'UFRRJ - Universidade Federal Rural do Rio de Janeiro',
  'UFRPE - Universidade Federal Rural de Pernambuco',
  'UFRA - Universidade Federal Rural da Amazônia',
  'UFAM - Universidade Federal do Amazonas',
  'UFAC - Universidade Federal do Acre',
  'UFAL - Universidade Federal de Alagoas',
  'UNIFAP - Universidade Federal do Amapá',
  'UNIFEI - Universidade Federal de Itajubá',
  'UFJF - Universidade Federal de Juiz de Fora',
  'UFLA - Universidade Federal de Lavras',
  'UFOP - Universidade Federal de Ouro Preto',
  'UFTM - Universidade Federal do Triângulo Mineiro',
  'UFU - Universidade Federal de Uberlândia',
  'UFVJM - Universidade Federal dos Vales do Jequitinhonha e Mucuri',
  'UFV - Universidade Federal de Viçosa',
  'UFF - Universidade Federal Fluminense',
  // Estaduais
  'USP - Universidade de São Paulo',
  'UNICAMP - Universidade Estadual de Campinas',
  'UNESP - Universidade Estadual Paulista',
  'UERJ - Universidade do Estado do Rio de Janeiro',
  'UENF - Universidade Estadual do Norte Fluminense',
  'UEL - Universidade Estadual de Londrina',
  'UEM - Universidade Estadual de Maringá',
  'UEPG - Universidade Estadual de Ponta Grossa',
  'UNICENTRO - Universidade Estadual do Centro-Oeste',
  'UNEB - Universidade do Estado da Bahia',
  'UEFS - Universidade Estadual de Feira de Santana',
  'UESB - Universidade Estadual do Sudoeste da Bahia',
  'UESC - Universidade Estadual de Santa Cruz',
  'UECE - Universidade Estadual do Ceará',
  'UVA-CE - Universidade Estadual Vale do Acaraú',
  'UEA - Universidade do Estado do Amazonas',
  'UEPA - Universidade do Estado do Pará',
  'UEMS - Universidade Estadual de Mato Grosso do Sul',
  'UNEMAT - Universidade do Estado de Mato Grosso',
  'UERN - Universidade Estadual do Rio Grande do Norte',
  'UEPB - Universidade Estadual da Paraíba',
  'UPE - Universidade de Pernambuco',
  'UNEAL - Universidade Estadual de Alagoas',
  'UESPI - Universidade Estadual do Piauí',
  'UEMA - Universidade Estadual do Maranhão',
  'UEMG - Universidade do Estado de Minas Gerais',
  'UNIMONTES - Universidade Estadual de Montes Claros',
  // Privadas e confessionais
  'PUC-SP - Pontifícia Universidade Católica de São Paulo',
  'PUC-Rio - Pontifícia Universidade Católica do Rio de Janeiro',
  'PUC Minas - Pontifícia Universidade Católica de Minas Gerais',
  'PUCRS - Pontifícia Universidade Católica do Rio Grande do Sul',
  'PUCPR - Pontifícia Universidade Católica do Paraná',
  'PUC-Campinas - Pontifícia Universidade Católica de Campinas',
  'PUC Goiás - Pontifícia Universidade Católica de Goiás',
  'Mackenzie - Universidade Presbiteriana Mackenzie',
  'FGV - Fundação Getulio Vargas',
  'Insper - Instituto de Ensino e Pesquisa',
  'FAAP - Fundação Armando Alvares Penteado',
  'Anhembi Morumbi - Universidade Anhembi Morumbi',
  'UMESP - Universidade Metodista de São Paulo',
  'USF - Universidade de São Francisco',
  'Cruzeiro do Sul - Universidade Cruzeiro do Sul',
  'UNESA - Universidade Estácio de Sá',
  'UVA-RJ - Universidade Veiga de Almeida',
  'UCAM - Universidade Cândido Mendes',
  'FEI - Centro Universitário FEI',
  'USJT - Universidade São Judas Tadeu',
  // Institutos de pesquisa
  'FIOCRUZ - Fundação Oswaldo Cruz',
  'INPE - Instituto Nacional de Pesquisas Espaciais',
  'INPA - Instituto Nacional de Pesquisas da Amazônia',
  'EMBRAPA - Empresa Brasileira de Pesquisa Agropecuária',
  'IPEA - Instituto de Pesquisa Econômica Aplicada',
  'IBGE - Instituto Brasileiro de Geografia e Estatística',
  'MPEG - Museu Paraense Emílio Goeldi',
  'CBPF - Centro Brasileiro de Pesquisas Físicas',
  'INSA - Instituto Nacional do Semiárido',
]

// ─── Reference format helpers ─────────────────────────────────────────────

const TIPO_LABELS: Record<TipoBanca, string> = {
  'tcc': 'TCC',
  'mestrado-academico': 'Mestrado Acadêmico',
  'mestrado-profissional': 'Mestrado Profissional',
  'doutorado': 'Doutorado',
  'outro': 'Outro',
}

/** Reverse map: display label → TipoBanca key */
const TIPO_FROM_LABEL: Record<string, TipoBanca> = {
  'TCC': 'tcc',
  'Mestrado Acadêmico': 'mestrado-academico',
  'Mestrado Profissional': 'mestrado-profissional',
  'Doutorado': 'doutorado',
  'Outro': 'outro',
}

function formatABNTArguicao(a: Arguicao): string {
  const parts = a.autor.trim().split(' ')
  const last = parts.pop() ?? ''
  const first = parts.join(' ')
  const nome = last && first ? `${last.toUpperCase()}, ${first}` : a.autor.toUpperCase()
  const tipo = a.tipoBanca === 'outro' ? (a.tipoOutro || 'Arguição') : TIPO_LABELS[a.tipoBanca]
  const modalidade = a.modalidade ? ` — ${a.modalidade === 'qualificacao' ? 'Qualificação' : 'Defesa'}` : ''
  const ano = a.data ? a.data.slice(0, 4) : ''
  return `${nome}. **${a.titulo}**. ${ano}. ${tipo}${modalidade} — ${a.instituicao}.`
}

function formatAPAArguicao(a: Arguicao): string {
  const parts = a.autor.trim().split(' ')
  const last = parts.pop() ?? ''
  const initials = parts.map((p) => p[0] + '.').join(' ')
  const nome = last && initials ? `${last}, ${initials}` : a.autor
  const ano = a.data ? a.data.slice(0, 4) : 's.d.'
  const tipo = a.tipoBanca === 'outro' ? (a.tipoOutro || 'Arguição') : TIPO_LABELS[a.tipoBanca]
  const modalidade = a.modalidade ? `, ${a.modalidade === 'qualificacao' ? 'qualificação' : 'defesa'}` : ''
  return `${nome} (${ano}). *${a.titulo}* [${tipo}${modalidade}]. ${a.instituicao}.`
}

// ─── Export helpers ────────────────────────────────────────────────────────

function stripPageTags(text: string): string {
  return text // page tags are already plain text in markdown source
}

function toPlain(md: string): string {
  return md.replace(/[#*_~`>]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
}

// ─── Markdown-aware PDF renderer ─────────────────────────────────────────

type InlineSeg = { text: string; bold: boolean; italic: boolean; isPageRef: boolean }

/** Tokenizes inline Markdown into styled segments (bold, italic, page refs). */
function parseInlineMD(text: string): InlineSeg[] {
  const segs: InlineSeg[] = []
  const re = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|\b(pp?\.\s*\d+(?:[–\-]\d+)?)/g
  let last = 0; let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index), bold: false, italic: false, isPageRef: false })
    if (m[1] !== undefined)      segs.push({ text: m[1], bold: true,  italic: true,  isPageRef: false })
    else if (m[2] !== undefined) segs.push({ text: m[2], bold: true,  italic: false, isPageRef: false })
    else if (m[3] !== undefined) segs.push({ text: m[3], bold: false, italic: true,  isPageRef: false })
    else if (m[4] !== undefined) segs.push({ text: m[4], bold: false, italic: true,  isPageRef: false })
    else                         segs.push({ text: m[5], bold: true,  italic: false, isPageRef: true  })
    last = m.index + m[0].length
  }
  if (last < text.length) segs.push({ text: text.slice(last), bold: false, italic: false, isPageRef: false })
  return segs
}

function applySegFont(doc: jsPDF, seg: InlineSeg) {
  if (seg.isPageRef) {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(13, 148, 136)
  } else if (seg.bold && seg.italic) {
    doc.setFont('helvetica', 'bolditalic'); doc.setTextColor(30, 30, 30)
  } else if (seg.bold) {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30)
  } else if (seg.italic) {
    doc.setFont('helvetica', 'italic'); doc.setTextColor(60, 60, 60)
  } else {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50)
  }
}

/** Renders inline segments with word-wrap. Returns new y after last line. */
function renderInlineSegs(
  doc: jsPDF, segs: InlineSeg[],
  x: number, y: number, maxWidth: number, lineH: number,
  pageHeight: number, margin: number
): number {
  const sf = (doc as unknown as { internal: { scaleFactor: number } }).internal.scaleFactor
  const W = (t: string) => doc.getStringUnitWidth(t) * doc.getFontSize() / sf
  let curX = x
  for (const seg of segs) {
    applySegFont(doc, seg)
    const words = seg.text.split(/(\s+)/)
    for (const word of words) {
      if (!word) continue
      const ww = W(word)
      if (word.trim() && curX + ww > x + maxWidth + 0.1) {
        curX = x; y += lineH
        if (y > pageHeight - margin) { doc.addPage(); y = margin }
      }
      if (word.trim()) doc.text(word, curX, y)
      curX += ww
    }
  }
  doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50)
  return y + lineH
}

/**
 * Renders Markdown text into jsPDF with full formatting support:
 * # H1, ## H2, ### H3, **bold**, *italic*, ***bold+italic***,
 * - bullets, 1. numbered lists, > blockquotes, --- rules, blank lines.
 * Page references (p. X, pp. X–Y) are rendered in teal bold.
 * Returns the new y position.
 */
function renderMarkdownToPDF(
  doc: jsPDF, md: string,
  x: number, y: number, maxWidth: number, lineH: number,
  pageHeight: number, margin: number
): number {
  if (!md.trim()) return y
  const sf = (doc as unknown as { internal: { scaleFactor: number } }).internal.scaleFactor

  const checkSpace = (need: number) => {
    if (y + need > pageHeight - margin) { doc.addPage(); y = margin }
  }

  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()

    // Blank line → small gap
    if (!line.trim()) { y += lineH * 0.5; continue }

    // H1 (# …)
    if (/^#\s/.test(line)) {
      checkSpace(10); y += 1.5
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(30, 30, 30)
      const wrapped = doc.splitTextToSize(line.replace(/^#+\s*/, ''), maxWidth)
      doc.text(wrapped, x, y); y += wrapped.length * 6.5 + 1
      doc.setFontSize(9); continue
    }
    // H2 (## …)
    if (/^##\s/.test(line)) {
      checkSpace(8); y += 1
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 30, 30)
      const wrapped = doc.splitTextToSize(line.replace(/^#+\s*/, ''), maxWidth)
      doc.text(wrapped, x, y); y += wrapped.length * 5.5 + 0.5
      doc.setFontSize(9); continue
    }
    // H3 (### …)
    if (/^###\s/.test(line)) {
      checkSpace(7)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(50, 50, 50)
      const wrapped = doc.splitTextToSize(line.replace(/^#+\s*/, ''), maxWidth)
      doc.text(wrapped, x, y); y += wrapped.length * 5 + 0.5
      doc.setFontSize(9); continue
    }

    // Horizontal rule (--- / *** / ___)
    if (/^[-*_]{3,}$/.test(line.trim())) {
      checkSpace(5)
      doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3)
      doc.line(x, y - 1, x + maxWidth, y - 1); y += 3; continue
    }

    // Bullet list (- / * / +)
    const bulletM = line.match(/^[\-\*\+]\s+(.*)/)
    if (bulletM) {
      checkSpace(6); doc.setFontSize(9)
      const pw = doc.getStringUnitWidth('• ') * 9 / sf
      doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50)
      doc.text('•', x + 1, y)
      y = renderInlineSegs(doc, parseInlineMD(bulletM[1]), x + 1 + pw, y, maxWidth - 1 - pw, lineH, pageHeight, margin)
      continue
    }

    // Numbered list (1. 2. …)
    const numM = line.match(/^(\d+)\.\s+(.*)/)
    if (numM) {
      checkSpace(6); doc.setFontSize(9)
      const prefix = numM[1] + '. '
      const pw = doc.getStringUnitWidth(prefix) * 9 / sf
      doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50)
      doc.text(prefix, x, y)
      y = renderInlineSegs(doc, parseInlineMD(numM[2]), x + pw, y, maxWidth - pw, lineH, pageHeight, margin)
      continue
    }

    // Blockquote (> …)
    if (line.startsWith('> ')) {
      checkSpace(6); doc.setFontSize(9)
      doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.8)
      doc.line(x + 2, y - lineH + 1, x + 2, y + 0.8)
      const segs = parseInlineMD(line.slice(2))
      segs.forEach((s) => { if (!s.isPageRef && !s.bold) s.italic = true })
      y = renderInlineSegs(doc, segs, x + 6, y, maxWidth - 6, lineH, pageHeight, margin)
      continue
    }

    // Regular paragraph (with inline formatting)
    checkSpace(6); doc.setFontSize(9)
    y = renderInlineSegs(doc, parseInlineMD(line), x, y, maxWidth, lineH, pageHeight, margin)
  }

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(50, 50, 50)
  return y
}

// ─── Section helpers ───────────────────────────────────────────────────────

function getArguicaoSecoes(a: {
  secoes?: { id: string; label: string; content: string }[]
  comentariosGerais: string; questoesTeoricas: string
  questoesMetodologicas: string; comentariosEspecificos: string
  conclusoes: string; anotacaoOutrosMembros: string
}): { id: string; label: string; content: string }[] {
  const main = a.secoes ?? [
    { id: 'cg', label: 'Comentários Gerais',        content: a.comentariosGerais        || '' },
    { id: 'qt', label: 'Questões Teóricas',          content: a.questoesTeoricas          || '' },
    { id: 'qm', label: 'Questões Metodológicas',     content: a.questoesMetodologicas     || '' },
    { id: 'ce', label: 'Comentários Específicos',    content: a.comentariosEspecificos    || '' },
    { id: 'co', label: 'Conclusões',                 content: a.conclusoes                || '' },
  ]
  const result = [...main]
  if (a.anotacaoOutrosMembros?.trim())
    result.push({ id: 'anot', label: 'Anotações de Outros Membros da Banca', content: a.anotacaoOutrosMembros })
  return result
}

function makeDefaultSecoes(): { id: string; label: string; content: string }[] {
  return [
    'Comentários Gerais', 'Questões Teóricas', 'Questões Metodológicas',
    'Comentários Específicos', 'Conclusões',
  ].map(label => ({ id: crypto.randomUUID(), label, content: '' }))
}

function exportArguicaoMarkdown(a: Arguicao) {
  const tipo = a.tipoBanca === 'outro' ? (a.tipoOutro || 'Outro') : TIPO_LABELS[a.tipoBanca]
  const modalidade = a.modalidade ? ` — ${a.modalidade === 'qualificacao' ? 'Qualificação' : 'Defesa'}` : ''
  const lines = [
    `# ${a.titulo}`,
    '',
    `**Autora/Autor:** ${a.autor}`,
    `**Instituição:** ${a.instituicao}`,
    `**Orientador(a):** ${a.orientador}`,
    `**Banca:** ${[...a.bancaMembers].join('; ')}`,
    `**Tipo:** ${tipo}${modalidade}`,
    `**Data:** ${formatDate(a.data)}`,
    '',
  ]
  const sections = getArguicaoSecoes(a)
  for (const { label, content } of sections) {
    if (content.trim()) {
      lines.push(`## ${label}`, '', stripPageTags(content), '')
    }
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const el = document.createElement('a'); el.href = url; el.download = `arguicao-${a.id}.md`; el.click()
  URL.revokeObjectURL(url)
}

function exportParecerMarkdown(p: Parecer) {
  const lines = [
    `# ${p.titulo}`,
    '',
    p.autor ? `**Autor(a):** ${p.autor}` : '**Avaliação cega**',
    `**Solicitante:** ${p.solicitante}`,
    `**Data:** ${formatDate(p.data)}`,
    '',
    '## Parecer',
    '',
    stripPageTags(p.parecer),
    '',
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const el = document.createElement('a'); el.href = url; el.download = `parecer-${p.id}.md`; el.click()
  URL.revokeObjectURL(url)
}

function exportArguicaoPDF(a: Arguicao) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 20
  const pageWidth = 210
  const pageHeight = 297
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const ensureSpace = (need: number) => {
    if (y + need > pageHeight - margin) { doc.addPage(); y = margin }
  }

  // Header — clean, no background fill
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(13, 148, 136)
  doc.text('pqLAB · Arguição', margin, y)
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(30, 30, 30)
  const titleLines = doc.splitTextToSize(a.titulo, contentWidth)
  doc.text(titleLines, margin, y)
  y += titleLines.length * 6 + 2
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text(`${TIPO_LABELS[a.tipoBanca]}${a.modalidade ? ` · ${a.modalidade === 'qualificacao' ? 'Qualificação' : 'Defesa'}` : ''} · ${formatDate(a.data)}`, margin, y)
  y += 5
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageWidth - margin, y)
  y += 7

  // Metadata
  const meta: [string, string][] = [
    ['Autor(a)', a.autor],
    ['Instituição', a.instituicao],
    ['Orientador(a)', a.orientador],
    ['Banca', a.bancaMembers.join('; ')],
  ]
  for (const [label, value] of meta) {
    if (!value) continue
    ensureSpace(8)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(80, 80, 80)
    doc.text(label + ':', margin, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30, 30, 30)
    const lines = doc.splitTextToSize(value, contentWidth - 30)
    doc.text(lines, margin + 28, y)
    y += lines.length * 4.5 + 1
  }
  y += 4

  // Text sections
  const sections = getArguicaoSecoes(a)
  for (const { label: title, content } of sections) {
    if (!content.trim()) continue
    ensureSpace(12)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(13, 148, 136)
    doc.text(title.toUpperCase(), margin, y); y += 5
    doc.setFontSize(9)
    y = renderMarkdownToPDF(doc, content, margin, y, contentWidth, 4.5, pageHeight, margin)
    y += 4
  }

  // Page numbers
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(160, 160, 160)
    doc.text(`${i} / ${total}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
  }

  doc.save(`arguicao-${a.id}.pdf`)
}

function exportParecerPDF(p: Parecer) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 20
  const pageWidth = 210
  const pageHeight = 297
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const ensureSpace = (need: number) => {
    if (y + need > pageHeight - margin) { doc.addPage(); y = margin }
  }

  // Header — clean, no background fill
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(13, 148, 136)
  doc.text('pqLAB · Parecer', margin, y)
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(30, 30, 30)
  const titleLines = doc.splitTextToSize(p.titulo, contentWidth)
  doc.text(titleLines, margin, y)
  y += titleLines.length * 6 + 2
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text(`${formatDate(p.data)}${p.solicitante ? ` · ${p.solicitante}` : ''}`, margin, y)
  y += 5
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageWidth - margin, y)
  y += 7

  const meta: [string, string][] = [
    [p.autor ? 'Autor(a)' : '', p.autor || ''],
    ['Solicitante', p.solicitante],
  ]
  for (const [label, value] of meta) {
    if (!label || !value) continue
    ensureSpace(8)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(80, 80, 80)
    doc.text(label + ':', margin, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30, 30, 30)
    const lines = doc.splitTextToSize(value, contentWidth - 30)
    doc.text(lines, margin + 28, y); y += lines.length * 4.5 + 1
  }
  y += 6

  ensureSpace(12)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(13, 148, 136)
  doc.text('PARECER', margin, y); y += 5
  doc.setFontSize(9)
  y = renderMarkdownToPDF(doc, p.parecer, margin, y, contentWidth, 4.5, pageHeight, margin)

  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(160, 160, 160)
    doc.text(`${i} / ${total}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
  }

  doc.save(`parecer-${p.id}.pdf`)
}

async function exportArguicaoDocx(a: Arguicao) {
  const tipo = a.tipoBanca === 'outro' ? (a.tipoOutro || 'Outro') : TIPO_LABELS[a.tipoBanca]
  const modalidade = a.modalidade ? ` — ${a.modalidade === 'qualificacao' ? 'Qualificação' : 'Defesa'}` : ''

  const metaRows = [
    ['Autor(a)', a.autor],
    ['Instituição', a.instituicao],
    ['Orientador(a)', a.orientador],
    ['Demais membros da banca', a.bancaMembers.join('; ')],
    ['Tipo', `${tipo}${modalidade}`],
    ['Data', formatDate(a.data)],
  ]

  const sections = getArguicaoSecoes(a)

  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: metaRows
      .filter(([, v]) => v)
      .map(([label, value]) => new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20 })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: value, size: 20 })] })],
          }),
        ],
      })),
  })

  const children = [
    new Paragraph({ text: a.titulo, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: 'Arguição · pqLAB', style: 'Normal' }),
    new Paragraph({ text: '' }),
    metaTable,
    new Paragraph({ text: '' }),
    ...sections.flatMap(({ label: title, content }) => {
      if (!content.trim()) return []
      return [
        new Paragraph({ text: title, heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ children: [new TextRun({ text: toPlain(content), size: 22 })] }),
        new Paragraph({ text: '' }),
      ]
    }),
  ]

  const doc = new Document({
    sections: [{ children }],
    styles: {
      default: {
        heading1: { run: { bold: true, size: 32, color: '0D9488' } },
        heading2: { run: { bold: true, size: 24, color: '0D9488' } },
      },
    },
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const el = document.createElement('a'); el.href = url; el.download = `arguicao-${a.id}.docx`; el.click()
  URL.revokeObjectURL(url)
}

async function exportParecerDocx(p: Parecer) {
  const children = [
    new Paragraph({ text: p.titulo, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: 'Parecer · pqLAB', style: 'Normal' }),
    new Paragraph({ text: '' }),
    ...(p.autor ? [new Paragraph({ children: [new TextRun({ text: 'Autor(a): ', bold: true }), new TextRun({ text: p.autor })] })] : [
      new Paragraph({ children: [new TextRun({ text: 'Avaliação cega', italics: true, color: '666666' })] }),
    ]),
    new Paragraph({ children: [new TextRun({ text: 'Solicitante: ', bold: true }), new TextRun({ text: p.solicitante })] }),
    new Paragraph({ children: [new TextRun({ text: 'Data: ', bold: true }), new TextRun({ text: formatDate(p.data) })] }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: 'Parecer', heading: HeadingLevel.HEADING_2 }),
    new Paragraph({ children: [new TextRun({ text: toPlain(p.parecer), size: 22 })] }),
  ]

  const doc = new Document({
    sections: [{ children }],
    styles: {
      default: {
        heading1: { run: { bold: true, size: 32, color: '0D9488' } },
        heading2: { run: { bold: true, size: 24, color: '0D9488' } },
      },
    },
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const el = document.createElement('a'); el.href = url; el.download = `parecer-${p.id}.docx`; el.click()
  URL.revokeObjectURL(url)
}

function exportAllCSV(revisoes: Revisao[]) {
  const header = ['Tipo', 'Título', 'Autor(a)', 'Instituição/Solicitante', 'Data', 'Tipo de Banca', 'Modalidade', 'Orientador(a)', 'Membros da Banca']
  const rows = revisoes.map((r) => {
    if (r.subtype === 'arguicao') {
      return [
        'Arguição', r.titulo, r.autor, r.instituicao, r.data,
        TIPO_LABELS[r.tipoBanca], r.modalidade ?? '', r.orientador,
        r.bancaMembers.join('; '),
      ]
    } else {
      return ['Parecer', r.titulo, r.autor ?? '', r.solicitante, r.data, '', '', '', '']
    }
  })
  const csv = [header, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const el = document.createElement('a'); el.href = url; el.download = 'revisoes.csv'; el.click()
  URL.revokeObjectURL(url)
}

// ─── Arguição form ─────────────────────────────────────────────────────────

const EMPTY_ARGUICAO: Omit<Arguicao, 'id' | 'created_at' | 'updated_at'> = {
  subtype: 'arguicao', titulo: '', autor: '', instituicao: '', orientador: '',
  bancaMembers: [], tipoBanca: 'mestrado-academico', modalidade: 'defesa',
  data: new Date().toISOString().slice(0, 10),
  comentariosGerais: '', questoesTeoricas: '', questoesMetodologicas: '',
  comentariosEspecificos: '', conclusoes: '', anotacaoOutrosMembros: '',
}

function ArguicaoForm({
  initial, onSave, onClose,
}: {
  initial?: Arguicao; onSave: (a: Arguicao) => void; onClose: () => void
}) {
  const [form, setForm] = useState<Omit<Arguicao, 'id' | 'created_at' | 'updated_at'>>(
    initial ? { ...initial } : { ...EMPTY_ARGUICAO }
  )
  const [newMembro, setNewMembro] = useState('')
  const [instValue, setInstValue] = useState(initial?.instituicao ?? '')
  const [tipoBancaInput, setTipoBancaInput] = useState(() => {
    if (!initial) return TIPO_LABELS['mestrado-academico']
    if (initial.tipoBanca === 'outro') return initial.tipoOutro ?? TIPO_LABELS['outro']
    return TIPO_LABELS[initial.tipoBanca]
  })
  const [modalidadeInput, setModalidadeInput] = useState(() => {
    if (!initial?.modalidade) return ''
    return initial.modalidade === 'qualificacao' ? 'Qualificação' : 'Defesa'
  })

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  function handleTipoBancaChange(label: string) {
    setTipoBancaInput(label)
    const key = TIPO_FROM_LABEL[label]
    if (key) {
      set('tipoBanca', key)
      if (key !== 'outro') set('tipoOutro', undefined)
    } else if (label.trim()) {
      // Unknown value → treat as "outro" with free-form description
      set('tipoBanca', 'outro')
      set('tipoOutro', label)
    }
  }

  function handleModalidadeChange(label: string) {
    setModalidadeInput(label)
    if (label === 'Qualificação') set('modalidade', 'qualificacao')
    else if (label === 'Defesa') set('modalidade', 'defesa')
    else if (!label.trim()) set('modalidade', undefined)
  }

  function addMembro() {
    if (!newMembro.trim()) return
    set('bancaMembers', [...form.bancaMembers, newMembro.trim()])
    setNewMembro('')
  }

  function handleSave() {
    if (!form.titulo.trim() || !form.autor.trim()) return
    const now = new Date().toISOString()
    onSave({
      ...form,
      // Preserve existing secoes on edit; create defaults for new entries
      secoes: initial?.secoes ?? (initial ? getArguicaoSecoes(initial) : makeDefaultSecoes()),
      id: initial?.id ?? crypto.randomUUID(),
      created_at: initial?.created_at ?? now,
      updated_at: now,
    })
  }

  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label className="text-xs">Título do trabalho *</Label>
          <Input value={form.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Título completo" className="mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Autor(a) *</Label>
            <Input value={form.autor} onChange={(e) => set('autor', e.target.value)} placeholder="Nome completo" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Data da banca</Label>
            <Input type="date" value={form.data} onChange={(e) => set('data', e.target.value)} className="mt-1" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Instituição</Label>
          <Input
            list="instituicoes-list"
            value={instValue}
            onChange={(e) => { setInstValue(e.target.value); set('instituicao', e.target.value) }}
            placeholder="Digite a sigla ou nome (ex: UFPA)"
            className="mt-1"
          />
          <datalist id="instituicoes-list">
            {INSTITUICOES_BRASIL.map((inst) => (
              <option key={inst} value={inst} />
            ))}
          </datalist>
        </div>
        <div>
          <Label className="text-xs">Orientador(a)</Label>
          <Input value={form.orientador} onChange={(e) => set('orientador', e.target.value)} placeholder="Nome e titulação" className="mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Tipo de banca</Label>
            <Input
              list="tipo-banca-list"
              value={tipoBancaInput}
              onChange={(e) => handleTipoBancaChange(e.target.value)}
              placeholder="Ex.: Mestrado Acadêmico"
              className="mt-1"
            />
            <datalist id="tipo-banca-list">
              <option value="TCC" />
              <option value="Mestrado Acadêmico" />
              <option value="Mestrado Profissional" />
              <option value="Doutorado" />
              <option value="Outro" />
            </datalist>
          </div>
          <div>
            <Label className="text-xs">Modalidade</Label>
            <Input
              list="modalidade-list"
              value={modalidadeInput}
              onChange={(e) => handleModalidadeChange(e.target.value)}
              placeholder="Ex.: Defesa"
              className="mt-1"
            />
            <datalist id="modalidade-list">
              <option value="Qualificação" />
              <option value="Defesa" />
            </datalist>
          </div>
        </div>
        <div>
          <Label className="text-xs">Demais membros da banca</Label>
          <div className="flex gap-2 mt-1">
            <Input value={newMembro} onChange={(e) => setNewMembro(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMembro() } }}
              placeholder="Nome e instituição" className="flex-1" />
            <Button type="button" size="sm" variant="outline" onClick={addMembro} disabled={!newMembro.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {form.bancaMembers.length > 0 && (
            <div className="mt-2 space-y-1">
              {form.bancaMembers.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-gray-50 px-2 py-1 rounded">
                  <span className="flex-1">{m}</span>
                  <button type="button" onClick={() => set('bancaMembers', form.bancaMembers.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 italic border-t pt-3">As seções de conteúdo podem ser editadas diretamente no card após salvar.</p>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={!form.titulo.trim() || !form.autor.trim()} className="bg-teal-600 hover:bg-teal-700 text-white">
          Salvar
        </Button>
      </div>
    </div>
  )
}

// ─── Parecer form ──────────────────────────────────────────────────────────

const EMPTY_PARECER: Omit<Parecer, 'id' | 'created_at' | 'updated_at'> = {
  subtype: 'parecer', titulo: '', autor: undefined, solicitante: '',
  data: new Date().toISOString().slice(0, 10), parecer: '',
}

function ParecerForm({
  initial, onSave, onClose,
}: {
  initial?: Parecer; onSave: (p: Parecer) => void; onClose: () => void
}) {
  const [form, setForm] = useState<Omit<Parecer, 'id' | 'created_at' | 'updated_at'>>(
    initial ? { ...initial } : { ...EMPTY_PARECER }
  )
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  function handleSave() {
    if (!form.titulo.trim() || !form.solicitante.trim()) return
    const now = new Date().toISOString()
    onSave({
      ...form,
      id: initial?.id ?? crypto.randomUUID(),
      created_at: initial?.created_at ?? now,
      updated_at: now,
    })
  }

  return (
    <div className="space-y-4 py-2">
      <div>
        <Label className="text-xs">Título do trabalho *</Label>
        <Input value={form.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Título do artigo, projeto ou livro" className="mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <Label className="text-xs">Autor(a) <span className="text-gray-400">(opcional)</span></Label>
          <p className="text-xs text-gray-400 mb-1">Deixe em branco para avaliação cega.</p>
          <Input value={form.autor ?? ''} onChange={(e) => set('autor', e.target.value || undefined)} placeholder="Nome do(a) autor(a)" />
        </div>
        <div>
          <Label className="text-xs">Data do parecer</Label>
          <Input type="date" value={form.data} onChange={(e) => set('data', e.target.value)} className="mt-1" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Solicitante *</Label>
        <Input value={form.solicitante} onChange={(e) => set('solicitante', e.target.value)}
          placeholder="Ex.: Edital nº 01/2026, Revista X, CNPQ chamada Y..." className="mt-1" />
      </div>
      <p className="text-xs text-gray-400 italic">O texto do parecer pode ser editado diretamente no card após salvar.</p>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={!form.titulo.trim() || !form.solicitante.trim()} className="bg-teal-600 hover:bg-teal-700 text-white">
          Salvar
        </Button>
      </div>
    </div>
  )
}

// ─── Arguição card ─────────────────────────────────────────────────────────

type RefFormat = 'abnt' | 'apa' | 'tabela'

function ArguicaoCard({
  a, refFormat, onEdit, onDelete, onUpdate, isDemoMode, defaultExpanded = false,
}: {
  a: Arguicao; refFormat: RefFormat; onEdit: () => void; onDelete: () => void
  onUpdate: (updated: Arguicao) => void; isDemoMode: boolean; defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [data, setData] = useState(a)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [editingLabelIdx, setEditingLabelIdx] = useState<number | null>(null)
  const [labelDraft, setLabelDraft] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => { setData(a) }, [a])

  const triggerSave = useCallback((updated: Arguicao) => {
    setSaveStatus('unsaved')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        if (!isDemoMode) await saveRevisao(updated)
        onUpdate(updated)
        setSaveStatus('saved')
      } catch { setSaveStatus('unsaved') }
    }, 1500)
  }, [isDemoMode, onUpdate])

  function updateContent(updated: Arguicao) { setData(updated); triggerSave(updated) }

  const secoes = getArguicaoSecoes(data)

  function updateSecao(idx: number, patch: Partial<{ label: string; content: string }>) {
    const next = secoes.map((s, i) => i === idx ? { ...s, ...patch } : s)
    updateContent({ ...data, secoes: next, anotacaoOutrosMembros: data.anotacaoOutrosMembros })
  }

  function removeSecao(idx: number) {
    updateContent({ ...data, secoes: secoes.filter((_, i) => i !== idx), anotacaoOutrosMembros: data.anotacaoOutrosMembros })
  }

  function addSecao() {
    updateContent({ ...data, secoes: [...secoes, { id: crypto.randomUUID(), label: 'Nova seção', content: '' }], anotacaoOutrosMembros: data.anotacaoOutrosMembros })
  }

  const tipo = data.tipoBanca === 'outro' ? (data.tipoOutro || 'Outro') : TIPO_LABELS[data.tipoBanca]
  const modalidade = data.modalidade ? ` · ${data.modalidade === 'qualificacao' ? 'Qualificação' : 'Defesa'}` : ''

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Users className="w-4 h-4 text-teal-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="text-xs bg-teal-100 text-teal-700 border-teal-200">Arguição</Badge>
              <Badge variant="outline" className="text-xs">{tipo}{modalidade}</Badge>
            </div>
            <p className="font-semibold text-gray-900 leading-snug mt-1">{data.titulo}</p>
            <p className="text-sm text-gray-500 mt-0.5">{data.autor} · {data.instituicao}</p>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {formatDate(data.data)}
            </p>
            {!expanded && refFormat !== 'tabela' && (
              <p className="text-xs text-gray-500 mt-2 italic line-clamp-2">
                {refFormat === 'abnt' ? formatABNTArguicao(data).replace(/\*\*/g, '') : formatAPAArguicao(data).replace(/\*/g, '')}
              </p>
            )}
            {expanded && (
              <div className="mt-4 space-y-4">
                {/* Auto-save indicator */}
                <div className="flex justify-end">
                  <span className={`text-xs select-none transition-opacity ${saveStatus === 'saved' ? 'text-gray-300' : saveStatus === 'saving' ? 'text-gray-400' : 'text-amber-500'}`}>
                    {saveStatus === 'saving' ? 'Salvando…' : saveStatus === 'unsaved' ? '● Não salvo' : '✓ Salvo'}
                  </span>
                </div>

                {/* Reference block */}
                {refFormat === 'tabela' ? (
                  <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                    <tbody>
                      {[
                        ['Título', data.titulo], ['Autor(a)', data.autor], ['Orientador(a)', data.orientador],
                        ['Instituição', data.instituicao], ['Data', formatDate(data.data)],
                        ['Tipo', tipo + modalidade],
                        ...(data.bancaMembers.length > 0 ? [['Banca', data.bancaMembers.join('; ')]] : []),
                      ].map(([label, value]) => (
                        <tr key={label} className="border-b border-gray-100 last:border-0">
                          <td className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 w-36">{label}</td>
                          <td className="px-3 py-2 text-xs text-gray-800">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-700 font-mono leading-relaxed">
                    {refFormat === 'abnt' ? formatABNTArguicao(data).replace(/\*\*/g, '') : formatAPAArguicao(data).replace(/\*/g, '')}
                  </div>
                )}

                {/* Content sections — inline editable */}
                {secoes.map((secao, idx) => (
                  <div key={secao.id}>
                    <div className="flex items-center gap-1 mb-1.5">
                      {editingLabelIdx === idx ? (
                        <input
                          autoFocus
                          className="text-sm font-semibold flex-1 border border-teal-300 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-teal-400 uppercase tracking-wide text-teal-700"
                          value={labelDraft}
                          onChange={(e) => setLabelDraft(e.target.value)}
                          onBlur={() => { updateSecao(idx, { label: labelDraft.trim() || secao.label }); setEditingLabelIdx(null) }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { updateSecao(idx, { label: labelDraft.trim() || secao.label }); setEditingLabelIdx(null) }
                            if (e.key === 'Escape') setEditingLabelIdx(null)
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="text-sm font-semibold text-teal-700 uppercase tracking-wide flex items-center gap-1 group hover:text-teal-800"
                          onClick={() => { setLabelDraft(secao.label); setEditingLabelIdx(idx) }}
                          title="Clique para renomear"
                        >
                          {secao.label}
                          <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                        </button>
                      )}
                      {editingLabelIdx === idx && (
                        <button
                          type="button"
                          onClick={() => removeSecao(idx)}
                          className="ml-auto text-red-300 hover:text-red-500 transition-colors"
                          title="Remover seção"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <InlineMarkdownField
                      value={secao.content}
                      onChange={(v) => updateSecao(idx, { content: v })}
                      placeholder={`${secao.label}…`}
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addSecao}
                  className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar seção
                </button>

                {/* Anotações de Outros Membros — fixed optional section */}
                <div className="border-t pt-3">
                  <p className="text-sm font-semibold text-teal-700 uppercase tracking-wide mb-1.5">
                    Anotações de Outros Membros da Banca <span className="font-normal text-gray-400 normal-case">(opcional)</span>
                  </p>
                  <InlineMarkdownField
                    value={data.anotacaoOutrosMembros}
                    onChange={(v) => updateContent({ ...data, secoes, anotacaoOutrosMembros: v })}
                    placeholder="Anotações de outros membros…"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            <button onClick={() => exportArguicaoPDF(data)} title="Exportar PDF" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={() => exportArguicaoMarkdown(data)} title="Exportar Markdown" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
              <FileText className="w-4 h-4" />
            </button>
            <button onClick={() => exportArguicaoDocx(data)} title="Exportar DOCX" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
              <BookOpen className="w-4 h-4" />
            </button>
            <button onClick={onEdit} title="Editar metadados" className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={onDelete} title="Excluir" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
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

// ─── Parecer card ──────────────────────────────────────────────────────────

function ParecerCard({
  p, onEdit, onDelete, onUpdate, isDemoMode, defaultExpanded = false,
}: {
  p: Parecer; onEdit: () => void; onDelete: () => void
  onUpdate: (updated: Parecer) => void; isDemoMode: boolean; defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [data, setData] = useState(p)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => { setData(p) }, [p])

  const triggerSave = useCallback((updated: Parecer) => {
    setSaveStatus('unsaved')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        if (!isDemoMode) await saveRevisao(updated)
        onUpdate(updated)
        setSaveStatus('saved')
      } catch { setSaveStatus('unsaved') }
    }, 1500)
  }, [isDemoMode, onUpdate])

  function updateContent(updated: Parecer) { setData(updated); triggerSave(updated) }

  const wordCount = data.parecer.trim() ? data.parecer.trim().split(/\s+/).length : 0
  const charCount = data.parecer.length

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <ClipboardCheck className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge className="text-xs bg-cyan-100 text-cyan-700 border-cyan-200">Parecer</Badge>
            </div>
            <p className="font-semibold text-gray-900 leading-snug mt-1">{data.titulo}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {data.autor ? data.autor : <em className="text-gray-400">Avaliação cega</em>}
              {' · '}{data.solicitante}
            </p>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {formatDate(data.data)}
            </p>
            {expanded && (
              <div className="mt-4 space-y-3">
                {/* Auto-save indicator */}
                <div className="flex justify-end">
                  <span className={`text-xs select-none transition-opacity ${saveStatus === 'saved' ? 'text-gray-300' : saveStatus === 'saving' ? 'text-gray-400' : 'text-amber-500'}`}>
                    {saveStatus === 'saving' ? 'Salvando…' : saveStatus === 'unsaved' ? '● Não salvo' : '✓ Salvo'}
                  </span>
                </div>

                {/* Parecer — inline editable */}
                <div>
                  <p className="text-sm font-semibold text-cyan-700 uppercase tracking-wide mb-1.5">Parecer</p>
                  <InlineMarkdownField
                    value={data.parecer}
                    onChange={(v) => updateContent({ ...data, parecer: v })}
                    placeholder="Escreva o parecer aqui…"
                  />
                  <p className="text-xs text-gray-400 mt-1.5 text-right">
                    {wordCount} {wordCount === 1 ? 'palavra' : 'palavras'} · {charCount} caracteres
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            <button onClick={() => exportParecerPDF(data)} title="Exportar PDF" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={() => exportParecerMarkdown(data)} title="Exportar Markdown" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
              <FileText className="w-4 h-4" />
            </button>
            <button onClick={() => exportParecerDocx(data)} title="Exportar DOCX" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
              <BookOpen className="w-4 h-4" />
            </button>
            <button onClick={onEdit} title="Editar metadados" className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={onDelete} title="Excluir" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
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

// ─── Type chooser dialog ────────────────────────────────────────────────────

function TypeChooserDialog({
  open, onChoose, onClose,
}: {
  open: boolean; onChoose: (t: 'arguicao' | 'parecer') => void; onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova Revisão</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 mb-4">Qual o tipo de revisão?</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => onChoose('arguicao')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-teal-200 hover:border-teal-500 hover:bg-teal-50 transition-colors">
            <Users className="w-8 h-8 text-teal-600" />
            <span className="text-sm font-semibold text-teal-700">Arguição</span>
            <span className="text-xs text-gray-500 text-center">TCC, dissertação, tese, qualificação</span>
          </button>
          <button onClick={() => onChoose('parecer')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-cyan-200 hover:border-cyan-500 hover:bg-cyan-50 transition-colors">
            <ClipboardCheck className="w-8 h-8 text-cyan-600" />
            <span className="text-sm font-semibold text-cyan-700">Parecer</span>
            <span className="text-xs text-gray-500 text-center">Artigo, projeto, livro, edital</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── YAML import helpers ──────────────────────────────────────────────────────

function parseRevisaoYaml(text: string): Revisao | null {
  try {
    const obj = yamlLoad(text) as Record<string, unknown>
    if (!obj || typeof obj !== 'object') return null
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    if (obj.subtype === 'parecer') {
      if (!obj.titulo || !obj.solicitante) return null
      return {
        id,
        subtype: 'parecer',
        titulo: String(obj.titulo),
        autor: obj.autor ? String(obj.autor) : undefined,
        solicitante: String(obj.solicitante),
        data: obj.data ? String(obj.data) : now.slice(0, 10),
        parecer: obj.parecer ? String(obj.parecer) : '',
        created_at: obj.created_at ? String(obj.created_at) : now,
        updated_at: now,
      } satisfies Parecer
    }
    if (obj.subtype === 'arguicao') {
      if (!obj.titulo || !obj.autor) return null
      return {
        id,
        subtype: 'arguicao',
        titulo: String(obj.titulo),
        autor: String(obj.autor),
        instituicao: obj.instituicao ? String(obj.instituicao) : '',
        orientador: obj.orientador ? String(obj.orientador) : '',
        bancaMembers: Array.isArray(obj.bancaMembers) ? obj.bancaMembers.map(String) : [],
        tipoBanca: (obj.tipoBanca as TipoBanca) ?? 'outro',
        modalidade: (obj.modalidade as ModalidadeBanca) ?? undefined,
        secoes: Array.isArray(obj.secoes) ? obj.secoes as Arguicao['secoes'] : undefined,
        comentariosGerais: obj.comentariosGerais ? String(obj.comentariosGerais) : '',
        questoesTeoricas: obj.questoesTeoricas ? String(obj.questoesTeoricas) : '',
        questoesMetodologicas: obj.questoesMetodologicas ? String(obj.questoesMetodologicas) : '',
        comentariosEspecificos: obj.comentariosEspecificos ? String(obj.comentariosEspecificos) : '',
        conclusoes: obj.conclusoes ? String(obj.conclusoes) : '',
        anotacaoOutrosMembros: obj.anotacaoOutrosMembros ? String(obj.anotacaoOutrosMembros) : '',
        data: obj.data ? String(obj.data) : now.slice(0, 10),
        created_at: obj.created_at ? String(obj.created_at) : now,
        updated_at: now,
      } satisfies Arguicao
    }
    return null
  } catch {
    return null
  }
}

// ─── ImportDialog ─────────────────────────────────────────────────────────────

interface ImportItem { filename: string; revisao: Revisao | null }

function ImportDialog({
  open, onClose, onImported, isDemoMode, toast,
}: {
  open: boolean
  onClose: () => void
  onImported: (items: Revisao[]) => void
  isDemoMode: boolean
  toast: (opts: { title: string; variant?: 'default' | 'destructive' }) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [items, setItems] = useState<ImportItem[]>([])
  const [importing, setImporting] = useState(false)

  const valid = items.filter((i) => i.revisao !== null)

  async function processFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.name.endsWith('.yaml') || f.name.endsWith('.yml'))
    if (arr.length === 0) return
    const parsed: ImportItem[] = await Promise.all(
      arr.map(async (f) => {
        const text = await f.text()
        return { filename: f.name, revisao: parseRevisaoYaml(text) }
      })
    )
    setItems((prev) => {
      const existing = new Set(prev.map((i) => i.filename))
      return [...prev, ...parsed.filter((p) => !existing.has(p.filename))]
    })
  }

  async function handleImport() {
    if (valid.length === 0) return
    setImporting(true)
    try {
      if (!isDemoMode) {
        // Sequential saves — GitHub Contents API doesn't handle concurrent commits well
        for (const item of valid) {
          await saveRevisao(item.revisao!)
        }
      }
      onImported(valid.map((i) => i.revisao!))
      toast({ title: `${valid.length} revisão(ões) importada(s)` })
      setItems([])
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast({ title: `Erro ao importar: ${msg}`, variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    processFiles(e.dataTransfer.files)
  }

  if (!open) return null

  return (
    <Dialog open onOpenChange={(o) => { if (!o) { setItems([]); onClose() } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Revisões (YAML)</DialogTitle>
        </DialogHeader>

        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={[
            'border-2 border-dashed rounded-lg p-8 flex flex-col items-center gap-2 cursor-pointer transition-colors',
            isDragging
              ? 'border-teal-400 bg-teal-50'
              : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50',
          ].join(' ')}
        >
          <Upload className="w-8 h-8 text-gray-400" />
          <p className="text-sm font-medium text-gray-700">Arraste arquivos .yaml aqui</p>
          <p className="text-xs text-gray-400">ou clique para selecionar</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && processFiles(e.target.files)}
          />
        </div>

        {/* File list */}
        {items.length > 0 && (
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm px-1">
                {item.revisao
                  ? <CheckCircle2 className="w-4 h-4 text-teal-500 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                }
                <div className="min-w-0 flex-1">
                  <span className="truncate block font-medium text-gray-700">{item.filename}</span>
                  {item.revisao
                    ? <span className="text-xs text-gray-500 truncate block">
                        {item.revisao.subtype === 'parecer' ? '📄 Parecer' : '🎓 Arguição'} — {item.revisao.titulo}
                      </span>
                    : <span className="text-xs text-red-400">Formato inválido ou campos obrigatórios ausentes</span>
                  }
                </div>
                <button onClick={(e) => { e.stopPropagation(); setItems((prev) => prev.filter((_, j) => j !== i)) }}
                  className="text-gray-300 hover:text-gray-500 flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => { setItems([]); onClose() }}>Cancelar</Button>
          <Button
            onClick={handleImport}
            disabled={valid.length === 0 || importing}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {importing ? 'Importando…' : `Importar ${valid.length > 0 ? valid.length : ''} revisão(ões)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export function Revisoes() {
  const { isDemoMode } = useAuth()
  const { toasts, toast, dismiss } = useToast()
  const [revisoes, setRevisoes] = useState<Revisao[]>(isDemoMode ? DEMO : [])
  const [loading, setLoading] = useState(!isDemoMode)
  const [chooserOpen, setChooserOpen] = useState(false)
  const [formType, setFormType] = useState<'arguicao' | 'parecer' | null>(null)
  const [editing, setEditing] = useState<Revisao | undefined>()
  const [refFormat, setRefFormat] = useState<RefFormat>('abnt')
  const [filterType, setFilterType] = useState<'all' | 'arguicao' | 'parecer'>('all')
  const [sortBy, setSortBy] = useState<'data' | 'tipo' | 'titulo' | 'journal'>('data')
  const [sortAsc, setSortAsc] = useState(false)
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) return
    loadRevisoes()
      .then(setRevisoes)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[Revisoes] loadRevisoes falhou:', err)
        toast({ title: `Erro ao carregar revisões: ${msg}`, variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }, [isDemoMode])

  const handleSave = useCallback(async (r: Revisao) => {
    if (!isDemoMode) {
      try { await saveRevisao(r) } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[Revisoes] saveRevisao falhou:', err)
        toast({ title: `Erro ao salvar: ${msg}`, variant: 'destructive' }); return
      }
    }
    setRevisoes((prev) => {
      const idx = prev.findIndex((x) => x.id === r.id)
      if (idx >= 0) return prev.map((x) => x.id === r.id ? r : x)
      // New entry — auto-expand it
      setExpandedId(r.id)
      return [r, ...prev]
    })
    setFormType(null); setEditing(undefined)
    toast({ title: 'Revisão salva' })
  }, [isDemoMode, toast])

  const handleDelete = useCallback(async (id: string) => {
    if (!isDemoMode) {
      try { await deleteRevisao(id) } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[Revisoes] deleteRevisao falhou:', err)
        toast({ title: `Erro ao excluir: ${msg}`, variant: 'destructive' }); return
      }
    }
    setRevisoes((prev) => prev.filter((r) => r.id !== id))
    toast({ title: 'Revisão excluída' })
  }, [isDemoMode, toast])

  function openEdit(r: Revisao) {
    setEditing(r); setFormType(r.subtype)
  }

  function openNew(t: 'arguicao' | 'parecer') {
    setEditing(undefined); setFormType(t); setChooserOpen(false)
  }

  const filtered = useMemo(() => {
    let result = filterType === 'all' ? revisoes : revisoes.filter((r) => r.subtype === filterType)
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter((r) => {
        if (r.subtype === 'arguicao') {
          return r.titulo.toLowerCase().includes(q) ||
            r.autor.toLowerCase().includes(q) ||
            r.instituicao.toLowerCase().includes(q) ||
            r.data.includes(q)
        } else {
          return r.titulo.toLowerCase().includes(q) ||
            (r.autor?.toLowerCase().includes(q) ?? false) ||
            r.solicitante.toLowerCase().includes(q) ||
            r.data.includes(q)
        }
      })
    }
    const dir = sortAsc ? 1 : -1
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'data':
          return dir * (a.data ?? '').localeCompare(b.data ?? '')
        case 'tipo':
          return dir * a.subtype.localeCompare(b.subtype)
        case 'titulo':
          return dir * a.titulo.localeCompare(b.titulo, 'pt-BR', { sensitivity: 'base' })
        case 'journal': {
          const aJ = a.subtype === 'parecer' ? a.solicitante : (a.instituicao ?? '')
          const bJ = b.subtype === 'parecer' ? b.solicitante : (b.instituicao ?? '')
          return dir * aJ.localeCompare(bJ, 'pt-BR', { sensitivity: 'base' })
        }
        default: return 0
      }
    })
  }, [revisoes, filterType, search, sortBy, sortAsc])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando…</div>

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-teal-600" />
          <h1 className="text-lg font-semibold text-gray-900">Revisões</h1>
          <Badge variant="outline" className="text-xs">{revisoes.length}</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="h-8 pl-8 pr-3 text-xs w-44"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {/* Filter by type */}
          <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
            <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="arguicao">Arguições</SelectItem>
              <SelectItem value="parecer">Pareceres</SelectItem>
            </SelectContent>
          </Select>
          {/* Sort */}
          <div className="flex items-center gap-0">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="h-8 text-xs w-36 gap-1 rounded-r-none border-r-0">
                <ArrowUpDown className="w-3 h-3 opacity-50 flex-shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="data">Data</SelectItem>
                <SelectItem value="tipo">Tipo</SelectItem>
                <SelectItem value="titulo">Título</SelectItem>
                <SelectItem value="journal">Journal / Inst.</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={() => setSortAsc((v) => !v)}
              title={sortAsc ? 'Crescente' : 'Decrescente'}
              className="h-8 w-8 flex items-center justify-center border border-input rounded-r-md bg-background hover:bg-accent hover:text-accent-foreground transition-colors flex-shrink-0"
            >
              {sortAsc
                ? <ArrowUp className="w-3.5 h-3.5 text-teal-600" />
                : <ArrowDown className="w-3.5 h-3.5 text-teal-600" />
              }
            </button>
          </div>
          {/* Ref format (only relevant for arguições) */}
          <Select value={refFormat} onValueChange={(v) => setRefFormat(v as RefFormat)}>
            <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="abnt">ABNT</SelectItem>
              <SelectItem value="apa">APA</SelectItem>
              <SelectItem value="tabela">Tabela</SelectItem>
            </SelectContent>
          </Select>
          {/* CSV export */}
          {revisoes.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => exportAllCSV(revisoes)} className="h-8 text-xs gap-1">
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
          )}
          {/* Import YAML */}
          {!isDemoMode && (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="h-8 text-xs gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Importar
            </Button>
          )}
          <Button size="sm" onClick={() => setChooserOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white gap-1">
            <Plus className="w-4 h-4" /> Nova Revisão
          </Button>
        </div>
      </div>

      {/* Type chooser */}
      <TypeChooserDialog
        open={chooserOpen}
        onChoose={openNew}
        onClose={() => setChooserOpen(false)}
      />

      {/* Import YAML dialog */}
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        isDemoMode={isDemoMode}
        toast={toast}
        onImported={(imported) => {
          setRevisoes((prev) => {
            const ids = new Set(prev.map((r) => r.id))
            return [...imported.filter((r) => !ids.has(r.id)), ...prev]
          })
        }}
      />

      {/* Form dialogs */}
      {formType === 'arguicao' && (
        <Dialog open onOpenChange={(o) => { if (!o) { setFormType(null); setEditing(undefined) } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Arguição' : 'Nova Arguição'}</DialogTitle>
            </DialogHeader>
            <ArguicaoForm
              initial={editing?.subtype === 'arguicao' ? editing : undefined}
              onSave={(a) => handleSave(a)}
              onClose={() => { setFormType(null); setEditing(undefined) }}
            />
          </DialogContent>
        </Dialog>
      )}
      {formType === 'parecer' && (
        <Dialog open onOpenChange={(o) => { if (!o) { setFormType(null); setEditing(undefined) } }}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Parecer' : 'Novo Parecer'}</DialogTitle>
            </DialogHeader>
            <ParecerForm
              initial={editing?.subtype === 'parecer' ? editing : undefined}
              onSave={(p) => handleSave(p)}
              onClose={() => { setFormType(null); setEditing(undefined) }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma revisão ainda.</p>
          <p className="text-xs mt-1">Clique em "Nova Revisão" para começar.</p>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {filtered.map((r) =>
          r.subtype === 'arguicao' ? (
            <ArguicaoCard
              key={r.id} a={r} refFormat={refFormat}
              onEdit={() => openEdit(r)}
              onDelete={() => handleDelete(r.id)}
              onUpdate={(updated) => setRevisoes((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
              isDemoMode={isDemoMode}
              defaultExpanded={expandedId === r.id}
            />
          ) : (
            <ParecerCard
              key={r.id} p={r}
              onEdit={() => openEdit(r)}
              onDelete={() => handleDelete(r.id)}
              onUpdate={(updated) => setRevisoes((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
              isDemoMode={isDemoMode}
              defaultExpanded={expandedId === r.id}
            />
          )
        )}
      </div>
    </div>
  )
}
