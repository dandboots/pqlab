import { useState, useEffect, useRef } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import {
  List, Plus, Edit2, Trash2, GripVertical, X, ChevronDown, ChevronUp,
  CheckSquare, Square, FolderPlus, LayoutGrid, Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ToastContainer } from '@/components/ui/toast'
import { MarkdownEditor, MarkdownRenderer } from '@/components/shared/MarkdownEditor'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/useToast'
import { loadListas, saveLista, deleteLista } from '@/lib/storage'
import { formatDate } from '@/lib/utils'
import type { Lista, ListaItem, ListaGrupo } from '@/types'

// ─── Demo data ────────────────────────────────────────────────────────────

const DEMO: Lista[] = [
  {
    id: '1', title: 'Tarefas de março', description: 'Lista de afazeres do mês',
    grupos: [
      { id: 'g1', title: 'Pesquisa de campo', order: 0 },
      { id: 'g2', title: 'Escrita', order: 1 },
    ],
    items: [
      { id: 'i1', title: 'Transcrever entrevista #1', description: 'Entrevista gravada em 05/03', order: 0, done: true, grupoId: 'g1' },
      { id: 'i2', title: 'Visitar arquivo municipal', description: 'Verificar documentos da caixa 14', order: 1, done: false, grupoId: 'g1' },
      { id: 'i3', title: 'Redigir seção 2 da dissertação', order: 0, done: false, grupoId: 'g2' },
      { id: 'i4', title: 'Revisar fichamentos de Mills', order: 1, done: false, grupoId: 'g2' },
      { id: 'i5', title: 'Agendar reunião com orientador', order: 4, done: false },
    ],
    created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z',
  },
]

// ─── Canvas tag colors ────────────────────────────────────────────────────
const TAG_COLORS = [
  { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
]
function tagColor(idx: number) { return TAG_COLORS[idx % TAG_COLORS.length] }

// ─── Canvas item card (Listas – with checkbox) ────────────────────────────
function CanvasItemCard({
  item, canvaTags, onDragEnd, onUpdate, onDelete,
}: {
  item: ListaItem
  canvaTags: string[]
  onDragEnd: (x: number, y: number) => void
  onUpdate: (item: ListaItem) => void
  onDelete: () => void
}) {
  const [pos, setPos] = useState({ x: item.x ?? 40, y: item.y ?? 40 })
  const [dragging, setDragging] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal, setTitleVal] = useState(item.title)
  const start = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)

  useEffect(() => {
    if (!dragging) setPos({ x: item.x ?? 40, y: item.y ?? 40 })
  }, [item.x, item.y]) // eslint-disable-line react-hooks/exhaustive-deps

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button,input,textarea')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    start.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !start.current) return
    setPos({
      x: Math.max(0, start.current.px + (e.clientX - start.current.mx)),
      y: Math.max(0, start.current.py + (e.clientY - start.current.my)),
    })
  }
  function onPointerUp() {
    if (!dragging) return
    setDragging(false)
    onDragEnd(pos.x, pos.y)
  }
  function saveTitle() {
    if (titleVal.trim()) onUpdate({ ...item, title: titleVal.trim() })
    else setTitleVal(item.title)
    setEditingTitle(false)
  }
  function toggleTag(tag: string) {
    const t = item.tags ?? []
    onUpdate({ ...item, tags: t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag] })
  }

  return (
    <div
      style={{ position: 'absolute', left: pos.x, top: pos.y, zIndex: dragging ? 50 : 1, touchAction: 'none' }}
      className={`w-52 bg-white rounded-xl border select-none transition-shadow
        ${dragging ? 'shadow-xl border-pink-300 cursor-grabbing' : 'shadow-sm border-gray-200 cursor-grab'}
        ${item.done ? 'opacity-60' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="flex items-center gap-1.5 px-2.5 pt-2.5 pb-1.5">
        <button onClick={() => onUpdate({ ...item, done: !item.done })} className="shrink-0">
          {item.done
            ? <CheckSquare className="w-4 h-4 text-green-500" />
            : <Square className="w-4 h-4 text-gray-400 hover:text-gray-600" />}
        </button>
        {editingTitle ? (
          <input autoFocus value={titleVal} onChange={(e) => setTitleVal(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitleVal(item.title); setEditingTitle(false) } }}
            className="flex-1 text-sm font-medium text-gray-900 focus:outline-none border-b border-pink-300 bg-transparent min-w-0" />
        ) : (
          <span onDoubleClick={() => setEditingTitle(true)}
            className={`flex-1 text-sm font-medium truncate ${item.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {item.title}
          </span>
        )}
        <button onClick={onDelete} className="shrink-0 text-gray-300 hover:text-red-500">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {item.description && (
        <p className="px-2.5 pb-1.5 text-xs text-gray-400 line-clamp-2 leading-relaxed">
          {item.description.replace(/[#*_`[\]]/g, '')}
        </p>
      )}
      {canvaTags.length > 0 && (
        <div className="px-2.5 pb-2.5 flex flex-wrap gap-1">
          {canvaTags.map((tag, idx) => {
            const c = tagColor(idx)
            const active = item.tags?.includes(tag)
            return (
              <button key={tag} onClick={() => toggleTag(tag)}
                className={`px-1.5 py-0.5 rounded-full text-xs font-medium border transition-all
                  ${active ? `${c.bg} ${c.text} ${c.border}` : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'}`}>
                {tag}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Item form dialog ──────────────────────────────────────────────────────

function ItemForm({
  open, onClose, onSave, initial, grupos,
}: {
  open: boolean; onClose: () => void; onSave: (item: ListaItem) => void; initial?: ListaItem; grupos: ListaGrupo[];
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [grupoId, setGrupoId] = useState(initial?.grupoId ?? '')

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? '')
      setDescription(initial?.description ?? '')
      setGrupoId(initial?.grupoId ?? '')
    }
  }, [open, initial])

  function handleSave() {
    if (!title.trim()) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      title: title.trim(),
      description: description || undefined,
      order: initial?.order ?? 0,
      done: initial?.done ?? false,
      grupoId: grupoId || undefined,
      attachment: initial?.attachment,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar item' : 'Novo item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do item" autoFocus />
          </div>
          {grupos.length > 0 && (
            <div className="space-y-1.5">
              <Label>Grupo</Label>
              <select
                value={grupoId}
                onChange={(e) => setGrupoId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <option value="">Sem grupo</option>
                {grupos.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <MarkdownEditor value={description} onChange={setDescription} placeholder="Notas sobre este item..." minHeight={120} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!title.trim()}>
            {initial ? 'Salvar' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Lista editor ──────────────────────────────────────────────────────────

function ListaEditor({ lista, onSave, onClose }: { lista: Lista; onSave: (l: Lista) => void; onClose: () => void }) {
  const [current, setCurrent] = useState<Lista>(lista)
  const [newGrupo, setNewGrupo] = useState('')
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ListaItem | undefined>()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  function toggleExpand(id: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    const items = Array.from(current.items)
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    setCurrent((prev) => ({ ...prev, items: items.map((item, i) => ({ ...item, order: i })) }))
  }

  function addGrupo() {
    if (!newGrupo.trim()) return
    const g: ListaGrupo = { id: crypto.randomUUID(), title: newGrupo.trim(), order: current.grupos.length }
    setCurrent((prev) => ({ ...prev, grupos: [...prev.grupos, g] }))
    setNewGrupo('')
  }

  function handleItemSave(item: ListaItem) {
    setCurrent((prev) => {
      const idx = prev.items.findIndex((x) => x.id === item.id)
      if (idx >= 0) {
        const next = [...prev.items]; next[idx] = item; return { ...prev, items: next }
      }
      return { ...prev, items: [...prev.items, { ...item, order: prev.items.length }] }
    })
  }

  function toggleDone(id: string) {
    setCurrent((prev) => ({
      ...prev,
      items: prev.items.map((item) => item.id === id ? { ...item, done: !item.done } : item),
    }))
  }

  async function handleSave() {
    setSaving(true)
    await onSave({ ...current, updated_at: new Date().toISOString() })
    setSaving(false)
  }

  const done = current.items.filter((i) => i.done).length
  const total = current.items.length

  // Group items for display
  const ungrouped = current.items.filter((i) => !i.grupoId)
  const grouped = current.grupos.map((g) => ({
    group: g,
    items: current.items.filter((i) => i.grupoId === g.id),
  }))

  function renderItem(item: ListaItem, dragIndex: number) {
    const expanded = expandedItems.has(item.id)
    return (
      <Draggable key={item.id} draggableId={item.id} index={dragIndex}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={`flex flex-col border rounded-lg overflow-hidden bg-white transition-all ${item.done ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <div {...provided.dragHandleProps} className="text-gray-300 hover:text-gray-500 cursor-grab shrink-0">
                <GripVertical className="w-4 h-4" />
              </div>
              <button onClick={() => toggleDone(item.id)} className="shrink-0">
                {item.done
                  ? <CheckSquare className="w-4 h-4 text-green-500" />
                  : <Square className="w-4 h-4 text-gray-400 hover:text-gray-600" />}
              </button>
              <span className={`flex-1 text-sm font-medium text-gray-900 ${item.done ? 'line-through text-gray-400' : ''}`}>
                {item.title}
              </span>
              {item.description && (
                <button onClick={() => toggleExpand(item.id)} className="p-1 text-gray-400 hover:text-gray-600 shrink-0">
                  {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
              <button onClick={() => { setEditingItem(item); setItemFormOpen(true) }} className="p-1 text-gray-400 hover:text-indigo-600 shrink-0">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrent((prev) => ({ ...prev, items: prev.items.filter((x) => x.id !== item.id) }))}
                className="p-1 text-gray-400 hover:text-red-500 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {expanded && item.description && (
              <div className="px-10 pb-3 border-t border-gray-100">
                <MarkdownRenderer content={item.description} className="text-sm" />
              </div>
            )}
          </div>
        )}
      </Draggable>
    )
  }

  // Build a flat ordered list for DnD (mixing groups and ungrouped)
  const allItemsOrdered = [...current.items].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-pink-50 border border-pink-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <input
              value={current.title}
              onChange={(e) => setCurrent((prev) => ({ ...prev, title: e.target.value }))}
              className="text-lg font-bold text-gray-900 bg-transparent focus:outline-none focus:border-b border-pink-300 w-full"
              placeholder="Título da lista"
            />
            <p className="text-sm text-gray-500 mt-0.5">
              {done}/{total} concluídos
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setEditingItem(undefined); setItemFormOpen(true) }}>
            <Plus className="w-4 h-4" /> Item
          </Button>
        </div>
      </div>

      {/* Grupos */}
      <div className="flex items-center gap-2 flex-wrap">
        <FolderPlus className="w-4 h-4 text-gray-400" />
        {current.grupos.map((g) => (
          <div key={g.id} className="flex items-center gap-1 bg-pink-50 border border-pink-200 rounded-lg px-2 py-1">
            <span className="text-xs text-pink-700 font-medium">{g.title}</span>
            <button
              onClick={() => setCurrent((prev) => ({
                ...prev,
                grupos: prev.grupos.filter((x) => x.id !== g.id),
                items: prev.items.map((item) => item.grupoId === g.id ? { ...item, grupoId: undefined } : item),
              }))}
              className="text-pink-400 hover:text-red-500"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <div className="flex gap-1">
          <Input value={newGrupo} onChange={(e) => setNewGrupo(e.target.value)} placeholder="Novo grupo" className="h-7 text-xs w-28"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGrupo() } }} />
          <Button size="sm" onClick={addGrupo} disabled={!newGrupo.trim()} className="h-7 text-xs px-2">
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Items - DnD */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="items">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
              {/* Grouped */}
              {grouped.map((g) => g.items.length > 0 && (
                <div key={g.group.id}>
                  <p className="text-xs font-semibold text-pink-600 uppercase tracking-wide px-1 mb-1">{g.group.title}</p>
                  {g.items.map((item) => renderItem(item, allItemsOrdered.findIndex((x) => x.id === item.id)))}
                </div>
              ))}
              {/* Ungrouped */}
              {ungrouped.length > 0 && (
                <div>
                  {current.grupos.length > 0 && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">Sem grupo</p>}
                  {ungrouped.map((item) => renderItem(item, allItemsOrdered.findIndex((x) => x.id === item.id)))}
                </div>
              )}
              {current.items.length === 0 && (
                <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                  <List className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum item. Clique em + Item para adicionar.</p>
                </div>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onClose}>Voltar</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar lista'}
        </Button>
      </div>

      <ItemForm
        open={itemFormOpen}
        onClose={() => { setItemFormOpen(false); setEditingItem(undefined) }}
        onSave={handleItemSave}
        initial={editingItem}
        grupos={current.grupos}
      />
    </div>
  )
}

// ─── Canvas editor (Listas) ───────────────────────────────────────────────
function CanvasEditor({ lista, onSave, onClose }: { lista: Lista; onSave: (l: Lista) => void; onClose: () => void }) {
  const [current, setCurrent] = useState<Lista>(lista)
  const [saving, setSaving] = useState(false)
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [newTagInput, setNewTagInput] = useState('')

  function addTag() {
    const tag = newTagInput.trim()
    if (!tag || current.canvaTags?.includes(tag)) return
    setCurrent((prev) => ({ ...prev, canvaTags: [...(prev.canvaTags ?? []), tag] }))
    setNewTagInput('')
  }

  function removeTag(tag: string) {
    setCurrent((prev) => ({
      ...prev,
      canvaTags: (prev.canvaTags ?? []).filter((t) => t !== tag),
      items: prev.items.map((i) => ({ ...i, tags: i.tags?.filter((t) => t !== tag) })),
    }))
    if (filterTag === tag) setFilterTag(null)
  }

  function handleDragEnd(id: string, x: number, y: number) {
    setCurrent((prev) => ({
      ...prev,
      items: prev.items.map((i) => i.id === id ? { ...i, x, y } : i),
    }))
  }

  function handleUpdate(item: ListaItem) {
    setCurrent((prev) => ({ ...prev, items: prev.items.map((i) => i.id === item.id ? item : i) }))
  }

  function handleDelete(id: string) {
    setCurrent((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) }))
  }

  function addItem() {
    const newItem: ListaItem = {
      id: crypto.randomUUID(),
      title: 'Novo item',
      order: current.items.length,
      done: false,
      x: 60 + Math.round(Math.random() * 300),
      y: 60 + Math.round(Math.random() * 200),
    }
    setCurrent((prev) => ({ ...prev, items: [...prev.items, newItem] }))
  }

  async function handleSave() {
    setSaving(true)
    await onSave({ ...current, updated_at: new Date().toISOString() })
    setSaving(false)
  }

  const displayed = filterTag ? current.items.filter((i) => i.tags?.includes(filterTag)) : current.items

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 flex items-center gap-3 flex-wrap">
        <input
          value={current.title}
          onChange={(e) => setCurrent((prev) => ({ ...prev, title: e.target.value }))}
          className="text-lg font-bold text-gray-900 bg-transparent focus:outline-none flex-1 min-w-0"
          placeholder="Título do canva"
        />
        <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-4 h-4" /> Item</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
        <Button size="sm" variant="outline" onClick={onClose}>Voltar</Button>
      </div>

      {/* Tag bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Tag className="w-4 h-4 text-gray-400 shrink-0" />
        {(current.canvaTags ?? []).map((tag, idx) => {
          const c = tagColor(idx)
          return (
            <button key={tag} onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all
                ${c.bg} ${c.text} ${c.border} ${filterTag === tag ? 'ring-2 ring-offset-1 ring-current' : ''}`}>
              {tag}
              <X className="w-3 h-3 opacity-60" onClick={(e) => { e.stopPropagation(); removeTag(tag) }} />
            </button>
          )
        })}
        <div className="flex gap-1">
          <Input value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)}
            placeholder="Nova tag" className="h-7 text-xs w-24"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} />
          <Button size="sm" onClick={addTag} disabled={!newTagInput.trim()} className="h-7 px-2"><Plus className="w-3 h-3" /></Button>
        </div>
        {filterTag && (
          <button onClick={() => setFilterTag(null)} className="text-xs text-gray-500 underline">Limpar filtro</button>
        )}
      </div>

      {/* Canvas surface */}
      <div className="border border-gray-200 rounded-xl overflow-auto bg-[#f8f9fb]" style={{ height: 560 }}>
        <div style={{ position: 'relative', width: 1600, height: 1100 }}>
          <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} width="1600" height="1100">
            <defs>
              <pattern id="dots-l" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="#e2e8f0" />
              </pattern>
            </defs>
            <rect width="1600" height="1100" fill="url(#dots-l)" />
          </svg>
          {displayed.map((item) => (
            <CanvasItemCard
              key={item.id}
              item={item}
              canvaTags={current.canvaTags ?? []}
              onDragEnd={(x, y) => handleDragEnd(item.id, x, y)}
              onUpdate={handleUpdate}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
          {displayed.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-400">
                <LayoutGrid className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">{filterTag ? 'Nenhum item com esta tag' : 'Clique em + Item para adicionar'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export function Listas() {
  const { isDemoMode } = useAuth()
  const { toasts, toast, dismiss } = useToast()
  const [listas, setListas] = useState<Lista[]>(isDemoMode ? DEMO : [])
  const [loading, setLoading] = useState(!isDemoMode)
  const [editing, setEditing] = useState<Lista | null>(null)
  const [newListOpen, setNewListOpen] = useState(false)
  const [newListTitle, setNewListTitle] = useState('')
  const [newListDesc, setNewListDesc] = useState('')
  const [newKind, setNewKind] = useState<'lista' | 'canva' | null>(null)

  useEffect(() => {
    if (isDemoMode) return
    loadListas()
      .then((data) => { setListas(data); setLoading(false) })
      .catch((err: Error) => {
        toast({ title: 'Erro ao carregar', description: err.message, variant: 'destructive' })
        setLoading(false)
      })
  }, [isDemoMode]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCreateList() {
    if (!newListTitle.trim() || !newKind) return
    const now = new Date().toISOString()
    const newLista: Lista = {
      id: crypto.randomUUID(), title: newListTitle.trim(),
      description: newListDesc || undefined,
      kind: newKind,
      grupos: [], items: [], created_at: now, updated_at: now,
    }
    setNewListOpen(false); setNewListTitle(''); setNewListDesc(''); setNewKind(null)
    setEditing(newLista)
  }

  async function handleSave(l: Lista) {
    if (!isDemoMode) {
      try { await saveLista(l) } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        toast({ title: 'Erro ao salvar', description: msg, variant: 'destructive' }); return
      }
    }
    setListas((prev) => {
      const idx = prev.findIndex((x) => x.id === l.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = l; return next }
      return [l, ...prev]
    })
    setEditing(null)
    toast({ title: 'Lista salva' })
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta lista?')) return
    if (!isDemoMode) {
      try { await deleteLista(id) } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        toast({ title: 'Erro ao excluir', description: msg, variant: 'destructive' }); return
      }
    }
    setListas((prev) => prev.filter((l) => l.id !== id))
    toast({ title: 'Lista excluída' })
  }

  if (editing) {
    return (
      <div className="animate-fade-in space-y-6">
        <ToastContainer toasts={toasts} onDismiss={dismiss} />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
            {editing.kind === 'canva' ? <LayoutGrid className="w-5 h-5 text-pink-600" /> : <List className="w-5 h-5 text-pink-600" />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{editing.title}</h1>
            <p className="text-sm text-gray-500">Editando {editing.kind === 'canva' ? 'canva' : 'lista'}</p>
          </div>
        </div>
        {editing.kind === 'canva'
          ? <CanvasEditor lista={editing} onSave={handleSave} onClose={() => setEditing(null)} />
          : <ListaEditor lista={editing} onSave={handleSave} onClose={() => setEditing(null)} />}
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
            <List className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Listas</h1>
            <p className="text-sm text-gray-500">{listas.length} lista{listas.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button onClick={() => setNewListOpen(true)}>
          <Plus className="w-4 h-4" /> Nova entrada
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-pink-500 rounded-full animate-spin" />
        </div>
      ) : listas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <List className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma lista ainda. Crie a primeira!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listas.map((lista) => {
            const done = lista.items.filter((i) => i.done).length
            const total = lista.items.length
            const progress = total > 0 ? Math.round((done / total) * 100) : 0
            return (
              <Card key={lista.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setEditing(lista)}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{lista.title}</h3>
                        {lista.kind === 'canva' && (
                          <Badge className="text-xs bg-pink-100 text-pink-700 border-pink-200">Canva</Badge>
                        )}
                      </div>
                      {lista.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{lista.description}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-400">{done}/{total} concluídos</span>
                        {lista.grupos.length > 0 && <Badge variant="secondary" className="text-xs">{lista.grupos.length} grupo{lista.grupos.length > 1 ? 's' : ''}</Badge>}
                      </div>
                      {total > 0 && (
                        <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                          <div className="bg-pink-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-2">{formatDate(lista.updated_at.split('T')[0])}</p>
                    </div>
                    <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setEditing(lista)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(lista.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* New list dialog */}
      <Dialog open={newListOpen} onOpenChange={(o) => { if (!o) { setNewListOpen(false); setNewListTitle(''); setNewListDesc(''); setNewKind(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova entrada</DialogTitle></DialogHeader>
          {!newKind ? (
            <div className="grid grid-cols-2 gap-3 py-2">
              <button onClick={() => setNewKind('lista')}
                className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 rounded-xl hover:border-pink-400 hover:bg-pink-50 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-pink-100 group-hover:bg-pink-200 flex items-center justify-center transition-colors">
                  <List className="w-5 h-5 text-pink-600" />
                </div>
                <span className="text-sm font-semibold text-gray-900">Lista</span>
                <span className="text-xs text-gray-500 text-center">Itens ordenados com checkboxes</span>
              </button>
              <button onClick={() => setNewKind('canva')}
                className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 rounded-xl hover:border-pink-400 hover:bg-pink-50 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-pink-100 group-hover:bg-pink-200 flex items-center justify-center transition-colors">
                  <LayoutGrid className="w-5 h-5 text-pink-600" />
                </div>
                <span className="text-sm font-semibold text-gray-900">Canva</span>
                <span className="text-xs text-gray-500 text-center">Notas visuais em espaço 2D</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 -mb-1">
                <button onClick={() => setNewKind(null)} className="text-pink-600 hover:underline">← Voltar</button>
                <span>•</span>
                <span>{newKind === 'canva' ? 'Novo canva' : 'Nova lista'}</span>
              </div>
              <div className="space-y-1.5">
                <Label>Título *</Label>
                <Input value={newListTitle} onChange={(e) => setNewListTitle(e.target.value)} placeholder="Nome" autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateList() }} />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição (opcional)</Label>
                <Input value={newListDesc} onChange={(e) => setNewListDesc(e.target.value)} placeholder="Breve descrição" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNewListOpen(false); setNewListTitle(''); setNewListDesc(''); setNewKind(null) }}>Cancelar</Button>
            {newKind && <Button onClick={handleCreateList} disabled={!newListTitle.trim()}>Criar</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
