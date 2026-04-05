// ─── GitHub-backed YAML storage for pqLAB ────────────────────────────────
// Folder structure:
//   data/diario/{id}.yaml
//   data/bookmarks/{id}.yaml
//   data/rssfeeds/{id}.yaml
//   data/fichamentos/{id}.yaml
//   data/planos/{id}.yaml
//   data/listas/{id}.yaml
//   data/revisoes/{id}.yaml
//   attachments/{module}/{id}/{filename}

import { load as yamlLoad, dump as yamlDump } from 'js-yaml'
import {
  getGitHubConfig,
  listDirectory,
  readFile,
  writeTextFile,
  writeBinaryFile,
  deleteFile as ghDeleteFile,
  decodeContent,
  getRawUrl,
} from './github'
import type {
  DiarioEntry,
  Bookmark,
  RssFeed,
  Fichamento,
  Plano,
  Lista,
  ListaSimples,
  ListaSimpleItem,
  Revisao,
  Anexo,
  Submissao,
  SubmissaoEvento,
} from '@/types'

// ─── SHA cache ────────────────────────────────────────────────────────────

const shaCache = new Map<string, string>()

function cfg() {
  const c = getGitHubConfig()
  if (!c) throw new Error('GitHub não configurado')
  return c
}

// ─── Anexo helpers ────────────────────────────────────────────────────────

type StoredAnexo = { id: string; name: string; size: number; type: string; path: string }

function storedToAnexo(sa: StoredAnexo): Anexo {
  return { ...sa, url: getRawUrl(cfg(), sa.path) }
}

function anexoToStored(a: Anexo): StoredAnexo {
  return { id: a.id, name: a.name, size: a.size, type: a.type, path: a.path }
}

// ─── YAML helpers ─────────────────────────────────────────────────────────

async function readYaml<T>(filePath: string): Promise<T> {
  const { content, sha, encoding } = await readFile(cfg(), filePath)
  shaCache.set(filePath, sha)
  const text = encoding === 'base64' ? decodeContent(content) : content
  return yamlLoad(text) as T
}

async function writeYaml<T extends object>(filePath: string, data: T, msg: string): Promise<void> {
  const text = yamlDump(data, { indent: 2, lineWidth: -1, skipInvalid: true })
  const sha = shaCache.get(filePath)
  const result = await writeTextFile(cfg(), filePath, text, msg, sha)
  shaCache.set(filePath, result.content.sha)
}

async function deleteYaml(filePath: string, msg: string): Promise<void> {
  let sha = shaCache.get(filePath)
  if (!sha) {
    const { sha: s } = await readFile(cfg(), filePath)
    sha = s
  }
  await ghDeleteFile(cfg(), filePath, sha, msg)
  shaCache.delete(filePath)
}

async function listYamls(dirPath: string): Promise<string[]> {
  const entries = await listDirectory(cfg(), dirPath)
  return entries
    .filter((e) => e.type === 'file' && e.name.endsWith('.yaml'))
    .map((e) => e.path)
}

// ─── File attachment upload ───────────────────────────────────────────────

export async function uploadAnexo(
  module: string,
  entityId: string,
  file: File
): Promise<Anexo> {
  const c = cfg()
  const filePath = `attachments/${module}/${entityId}/${file.name}`
  const result = await writeBinaryFile(c, filePath, file, `Upload ${file.name}`)
  shaCache.set(filePath, result.content.sha)
  return {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    type: file.type,
    path: filePath,
    url: getRawUrl(c, filePath),
  }
}

// ─── DIÁRIO DE CAMPO ──────────────────────────────────────────────────────

type StoredDiario = Omit<DiarioEntry, 'attachments'> & {
  attachments: StoredAnexo[]
}

export async function loadDiario(): Promise<DiarioEntry[]> {
  const files = await listYamls('data/diario')
  const docs = await Promise.all(files.map((f) => readYaml<StoredDiario>(f)))
  return docs
    .map((d) => ({ ...d, attachments: (d.attachments ?? []).map(storedToAnexo) }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export async function saveDiarioEntry(entry: DiarioEntry): Promise<void> {
  const doc: StoredDiario = {
    ...entry,
    updated_at: new Date().toISOString(),
    attachments: entry.attachments.map(anexoToStored),
  }
  await writeYaml(`data/diario/${entry.id}.yaml`, doc, `Update diario ${entry.id}`)
}

export async function deleteDiarioEntry(id: string): Promise<void> {
  await deleteYaml(`data/diario/${id}.yaml`, `Delete diario ${id}`)
}

// ─── BOOKMARKS ────────────────────────────────────────────────────────────

type StoredBookmark = Omit<Bookmark, 'attachments'> & {
  attachments: StoredAnexo[]
}

export async function loadBookmarks(): Promise<Bookmark[]> {
  const files = await listYamls('data/bookmarks')
  const docs = await Promise.all(files.map((f) => readYaml<StoredBookmark>(f)))
  return docs
    .map((d) => ({ ...d, attachments: (d.attachments ?? []).map(storedToAnexo) }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function saveBookmark(bookmark: Bookmark): Promise<void> {
  const doc: StoredBookmark = {
    ...bookmark,
    updated_at: new Date().toISOString(),
    attachments: bookmark.attachments.map(anexoToStored),
  }
  await writeYaml(`data/bookmarks/${bookmark.id}.yaml`, doc, `Update bookmark ${bookmark.id}`)
}

export async function deleteBookmark(id: string): Promise<void> {
  await deleteYaml(`data/bookmarks/${id}.yaml`, `Delete bookmark ${id}`)
}

// ─── RSS FEEDS ────────────────────────────────────────────────────────────

export async function loadRssFeeds(): Promise<RssFeed[]> {
  const files = await listYamls('data/rssfeeds')
  const docs = await Promise.all(files.map((f) => readYaml<RssFeed>(f)))
  return docs.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function saveRssFeed(feed: RssFeed): Promise<void> {
  await writeYaml(`data/rssfeeds/${feed.id}.yaml`, feed, `Update rssfeed ${feed.id}`)
}

export async function deleteRssFeed(id: string): Promise<void> {
  await deleteYaml(`data/rssfeeds/${id}.yaml`, `Delete rssfeed ${id}`)
}

// ─── FICHAMENTOS ──────────────────────────────────────────────────────────

type StoredFichamento = Omit<Fichamento, 'attachment'> & {
  attachment?: StoredAnexo
}

export async function loadFichamentos(): Promise<Fichamento[]> {
  const files = await listYamls('data/fichamentos')
  const docs = await Promise.all(files.map((f) => readYaml<StoredFichamento>(f)))
  return docs
    .map((d) => ({
      ...d,
      attachment: d.attachment ? storedToAnexo(d.attachment) : undefined,
      subEntries: d.subEntries ?? [],
      authors: d.authors ?? [],
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function saveFichamento(f: Fichamento): Promise<void> {
  const doc: StoredFichamento = {
    ...f,
    updated_at: new Date().toISOString(),
    attachment: f.attachment ? anexoToStored(f.attachment) : undefined,
  }
  await writeYaml(`data/fichamentos/${f.id}.yaml`, doc, `Update fichamento ${f.id}`)
}

export async function deleteFichamento(id: string): Promise<void> {
  await deleteYaml(`data/fichamentos/${id}.yaml`, `Delete fichamento ${id}`)
}

// ─── PLANOS ───────────────────────────────────────────────────────────────

export async function loadPlanos(): Promise<Plano[]> {
  const files = await listYamls('data/planos')
  const docs = await Promise.all(files.map((f) => readYaml<Plano>(f)))
  return docs
    .map((p) => ({
      ...p,
      modulos: p.modulos ?? [],
      aulas: p.aulas ?? [],
      professores: p.professores ?? [],
      recursos: p.recursos ?? [],
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function savePlano(p: Plano): Promise<void> {
  const doc = { ...p, updated_at: new Date().toISOString() }
  await writeYaml(`data/planos/${p.id}.yaml`, doc, `Update plano ${p.id}`)
}

export async function deletePlano(id: string): Promise<void> {
  await deleteYaml(`data/planos/${id}.yaml`, `Delete plano ${id}`)
}

// ─── LISTAS ───────────────────────────────────────────────────────────────

type StoredListaItem = Omit<import('@/types').ListaItem, 'attachment'> & {
  attachment?: StoredAnexo
}

type StoredLista = Omit<Lista, 'items'> & {
  items: StoredListaItem[]
}

export async function loadListas(): Promise<Lista[]> {
  const files = await listYamls('data/listas')
  const docs = await Promise.all(files.map((f) => readYaml<StoredLista>(f)))
  return docs
    .map((l) => ({
      ...l,
      grupos: l.grupos ?? [],
      items: (l.items ?? []).map((item) => ({
        ...item,
        attachment: item.attachment ? storedToAnexo(item.attachment) : undefined,
      })),
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function saveLista(lista: Lista): Promise<void> {
  const doc: StoredLista = {
    ...lista,
    updated_at: new Date().toISOString(),
    items: lista.items.map((item) => ({
      ...item,
      attachment: item.attachment ? anexoToStored(item.attachment) : undefined,
    })),
  }
  await writeYaml(`data/listas/${lista.id}.yaml`, doc, `Update lista ${lista.id}`)
}

export async function deleteLista(id: string): Promise<void> {
  await deleteYaml(`data/listas/${id}.yaml`, `Delete lista ${id}`)
}

// ─── LISTAS SIMPLES ───────────────────────────────────────────────────────

type StoredListaSimpleItem = ListaSimpleItem  // no attachment to strip

type StoredListaSimples = Omit<ListaSimples, 'items'> & {
  items: StoredListaSimpleItem[]
}

export async function loadListasSimples(): Promise<ListaSimples[]> {
  const files = await listYamls('data/listassimples')
  const docs = await Promise.all(files.map((f) => readYaml<StoredListaSimples>(f)))
  return docs
    .map((l) => ({
      ...l,
      grupos: l.grupos ?? [],
      items: l.items ?? [],
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function saveListaSimples(lista: ListaSimples): Promise<void> {
  const doc: StoredListaSimples = {
    ...lista,
    updated_at: new Date().toISOString(),
    items: lista.items,
  }
  await writeYaml(`data/listassimples/${lista.id}.yaml`, doc, `Update listasimples ${lista.id}`)
}

export async function deleteListaSimples(id: string): Promise<void> {
  await deleteYaml(`data/listassimples/${id}.yaml`, `Delete listasimples ${id}`)
}

// ─── REVISÕES ─────────────────────────────────────────────────────────────

export async function loadRevisoes(): Promise<Revisao[]> {
  const files = await listYamls('data/revisoes')
  const results = await Promise.allSettled(files.map((f) => readYaml<Revisao>(f)))
  return results
    .filter((r): r is PromiseFulfilledResult<Revisao> => r.status === 'fulfilled' && r.value != null)
    .map((r) => r.value)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function saveRevisao(r: Revisao): Promise<void> {
  const doc = { ...r, updated_at: new Date().toISOString() }
  await writeYaml(`data/revisoes/${r.id}.yaml`, doc, `Update revisao ${r.id}`)
}

export async function deleteRevisao(id: string): Promise<void> {
  await deleteYaml(`data/revisoes/${id}.yaml`, `Delete revisao ${id}`)
}

// ─── SUBMISSÕES ───────────────────────────────────────────────────────────

type StoredEvento = {
  id: string
  tipo: string
  descricao?: string
  data?: string
  revista?: string
  created_at: string
}

type StoredSubmissao = Omit<Submissao, 'user_id'> & {
  eventos: StoredEvento[]
}

const GH_USER_SUB = 'github-user'

export async function loadSubmissoes(): Promise<{
  submissoes: Submissao[]
  eventos: SubmissaoEvento[]
}> {
  const files = await listYamls('data/submissoes')
  const docs = await Promise.all(files.map((f) => readYaml<StoredSubmissao>(f)))

  const submissoes: Submissao[] = []
  const eventos: SubmissaoEvento[] = []

  for (const doc of docs) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { eventos: _e, ...rest } = doc
    submissoes.push({ ...rest, user_id: GH_USER_SUB })
    for (const e of doc.eventos ?? []) {
      eventos.push({ ...e, user_id: GH_USER_SUB, submissao_id: doc.id })
    }
  }

  return { submissoes, eventos }
}

export async function saveSubmissaoFile(
  submissao: Submissao,
  allEventos: SubmissaoEvento[]
): Promise<void> {
  const myEventos = allEventos.filter((e) => e.submissao_id === submissao.id)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user_id: _u, ...rest } = submissao
  const doc: StoredSubmissao = {
    ...rest,
    updated_at: new Date().toISOString(),
    eventos: myEventos.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      descricao: e.descricao,
      data: e.data,
      revista: e.revista,
      created_at: e.created_at,
    })),
  }
  await writeYaml(
    `data/submissoes/${submissao.id}.yaml`,
    doc,
    `Update submissao ${submissao.id}`
  )
}

export async function deleteSubmissaoFile(id: string): Promise<void> {
  await deleteYaml(`data/submissoes/${id}.yaml`, `Delete submissao ${id}`)
}
