import { useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { TreeData, Person } from '@shared/types'
import { personLabel, formatLifeSpan } from '../lib/labels'

interface Props {
  data: TreeData
  onSelectPerson: (id: string) => void
}

function PersonNode({ data }: { data: { person: Person; onSelect: (id: string) => void; isFocus: boolean } }) {
  const p = data.person
  return (
    <button
      className={`px-3 py-2 bg-white rounded-lg shadow-sm text-left min-w-[160px] hover:border-stone-500 ${
        data.isFocus ? 'border-2 border-stone-800' : 'border-2 border-stone-300'
      }`}
      onClick={() => data.onSelect(p.id)}
    >
      <div className="flex gap-2 items-center">
        {p.thumbUrl ? (
          <img src={p.thumbUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded bg-stone-100 shrink-0" />
        )}
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{personLabel(p)}</div>
          <div className="text-xs text-stone-500">{formatLifeSpan(p)}</div>
        </div>
      </div>
    </button>
  )
}

const nodeTypes = { person: PersonNode }

const NODE_W = 220
const NODE_H = 110

function layoutPositions(data: TreeData): Map<string, { x: number; y: number }> {
  const partnerOf = new Map<string, string>()
  for (const e of data.edges) {
    if (e.kind !== 'partner') continue
    partnerOf.set(e.source, e.target)
    partnerOf.set(e.target, e.source)
  }

  const gens = [...new Set(data.nodes.map((n) => n.generation))].sort((a, b) => a - b)
  const positions = new Map<string, { x: number; y: number }>()

  gens.forEach((g, row) => {
    const rowNodes = data.nodes.filter((n) => n.generation === g)
    const ordered: typeof rowNodes = []
    const used = new Set<string>()
    const sorted = [...rowNodes].sort((a, b) => personLabel(a.person).localeCompare(personLabel(b.person), 'ru'))
    for (const n of sorted) {
      if (used.has(n.id)) continue
      ordered.push(n)
      used.add(n.id)
      const pid = partnerOf.get(n.id)
      const partner = rowNodes.find((x) => x.id === pid)
      if (partner && !used.has(partner.id)) {
        ordered.push(partner)
        used.add(partner.id)
      }
    }
    const totalW = Math.max(ordered.length, 1) * NODE_W
    ordered.forEach((n, i) => {
      positions.set(n.id, {
        x: i * NODE_W - totalW / 2 + 80,
        y: row * NODE_H
      })
    })
  })

  return positions
}

export function TreeView({ data, onSelectPerson }: Props) {
  const layout = useMemo(() => {
    const positions = layoutPositions(data)
    const nodes: Node[] = data.nodes.map((n) => ({
      id: n.id,
      type: 'person',
      position: positions.get(n.id) ?? { x: 0, y: 0 },
      data: { person: n.person, onSelect: onSelectPerson, isFocus: n.id === data.focusPersonId }
    }))

    const edges: Edge[] = data.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      style: { stroke: e.kind === 'partner' ? '#a8a29e' : '#57534e' },
      label: e.kind === 'partner' ? '∞' : undefined
    }))

    return { nodes, edges }
  }, [data, onSelectPerson])

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges)

  useEffect(() => {
    setNodes(layout.nodes)
    setEdges(layout.edges)
  }, [layout, setNodes, setEdges])

  return (
    <div className="h-full w-full bg-stone-50 rounded-lg border border-stone-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        nodesDraggable={false}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}
