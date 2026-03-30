// ─── Shared attachment type ───────────────────────────────────────────────

export interface Anexo {
  id: string
  name: string
  size: number
  type: string
  path: string
  url?: string
}

// ─── Módulo 1: Diário de Campo ────────────────────────────────────────────

export interface DiarioEntry {
  id: string
  date: string          // YYYY-MM-DD
  title: string
  content: string       // markdown
  attachments: Anexo[]
  starred?: boolean
  created_at: string
  updated_at: string
}

// ─── Módulo 2: Bookmarks ─────────────────────────────────────────────────

export type BookmarkType = 'url' | 'doi' | 'file' | 'rss'

export interface Bookmark {
  id: string
  type: BookmarkType
  url?: string
  title: string
  description?: string
  image?: string        // thumbnail URL
  doi?: string
  authors?: string[]
  year?: number
  journal?: string
  tags?: string[]
  attachments: Anexo[]
  created_at: string
  updated_at: string
}

export interface RssFeed {
  id: string
  url: string
  title: string
  description?: string
  lastFetched?: string
  created_at: string
}

export interface RssItem {
  id: string
  feedId: string
  title: string
  link: string
  description?: string
  pubDate?: string
  image?: string
  content?: string
}

// ─── Módulo 3: Fichamentos ────────────────────────────────────────────────

export interface FichamentoSubEntry {
  id: string
  pages: string
  content: string
}

export interface Fichamento {
  id: string
  title: string
  authors: string[]
  year?: number
  journal?: string      // journal or book title
  publisher?: string
  doi?: string
  url?: string
  attachment?: Anexo    // PDF attachment
  summary: string       // markdown
  subEntries: FichamentoSubEntry[]
  created_at: string
  updated_at: string
}

// ─── Módulo 4: Planos ─────────────────────────────────────────────────────

export type RefType = 'mandatory' | 'complementary'

export interface PlanoRef {
  id: string
  title: string
  authors?: string[]
  year?: number
  doi?: string
  url?: string
  type: RefType
}

export interface PlanoAula {
  id: string
  date: string          // YYYY-MM-DD
  title: string
  description: string   // markdown
  order: number
  moduleId?: string
  references: PlanoRef[]
}

export interface PlanoModulo {
  id: string
  title: string
  description?: string
  order: number
}

export interface Plano {
  id: string
  disciplina: string
  professores: string[]
  ementa: string
  avaliacao: string
  periodo: string
  recursos: string[]    // links para pasta de textos, whatsapp etc.
  weekdays: number[]    // 0=Sun, 1=Mon ... 6=Sat
  frequency: 'weekly' | 'biweekly' | 'monthly'
  startDate: string     // YYYY-MM-DD
  endDate: string       // YYYY-MM-DD
  modulos: PlanoModulo[]
  aulas: PlanoAula[]
  created_at: string
  updated_at: string
}

// ─── Módulo 5: Listas ─────────────────────────────────────────────────────

export interface ListaGrupo {
  id: string
  title: string
  description?: string
  order: number
}

export interface ListaItem {
  id: string
  title: string
  description?: string  // markdown
  order: number
  done: boolean
  grupoId?: string
  dueDate?: string      // YYYY-MM-DD
  attachment?: Anexo
  x?: number
  y?: number
  tags?: string[]
}

export interface Lista {
  id: string
  title: string
  description?: string
  kind?: 'lista' | 'canva'
  canvaTags?: string[]
  grupos: ListaGrupo[]
  items: ListaItem[]
  created_at: string
  updated_at: string
}

// ─── Módulo 7: Revisões ───────────────────────────────────────────────────

export type TipoBanca = 'tcc' | 'mestrado-academico' | 'mestrado-profissional' | 'doutorado' | 'outro'
export type ModalidadeBanca = 'qualificacao' | 'defesa'

export interface Arguicao {
  id: string
  subtype: 'arguicao'
  titulo: string
  autor: string
  instituicao: string
  orientador: string
  bancaMembers: string[]
  tipoBanca: TipoBanca
  tipoOutro?: string
  modalidade?: ModalidadeBanca
  data: string              // YYYY-MM-DD
  secoes?: { id: string; label: string; content: string }[]
  comentariosGerais: string
  questoesTeoricas: string
  questoesMetodologicas: string
  comentariosEspecificos: string
  conclusoes: string
  anotacaoOutrosMembros: string
  created_at: string
  updated_at: string
}

export interface Parecer {
  id: string
  subtype: 'parecer'
  titulo: string
  autor?: string
  solicitante: string
  data: string              // YYYY-MM-DD
  parecer: string
  created_at: string
  updated_at: string
}

export type Revisao = Arguicao | Parecer

// ─── Módulo 6: Listas Simples (sem checkbox) ──────────────────────────────

export interface ListaSimpleItem {
  id: string
  title: string
  description?: string  // markdown
  order: number
  grupoId?: string
  x?: number
  y?: number
  tags?: string[]
}

export interface ListaSimples {
  id: string
  title: string
  description?: string
  starred?: boolean
  kind?: 'lista' | 'canva'
  canvaTags?: string[]
  grupos: ListaGrupo[]
  items: ListaSimpleItem[]
  created_at: string
  updated_at: string
}

// ─── Módulo Submissões ────────────────────────────────────────────────────

export interface Submissao {
  id: string
  user_id: string
  titulo_provisorio: string
  autores?: string[]
  resumo?: string
  coluna: string
  ultima_atividade?: string
  created_at: string
  updated_at: string
}

export interface SubmissaoEvento {
  id: string
  user_id: string
  submissao_id: string
  tipo: string
  descricao?: string
  data?: string
  revista?: string
  created_at: string
}
