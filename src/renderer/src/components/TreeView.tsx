import { useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { TreeData, TreeNode, Person } from '@shared/types'
import { personLabel, formatLifeSpan } from '../lib/labels'

interface Props {
  data: TreeData
  onSelectPerson: (id: string) => void
}

function PersonNode({ data }: { data: { person: Person; isFocus: boolean; onSelect: (id: string) => void } }) {
  const p = data.person
  return (
    <div
      className={`w-[210px] px-3 py-2.5 bg-white rounded-xl shadow-sm text-left cursor-pointer ${
        data.isFocus ? 'border-2 border-stone-800' : 'border border-stone-300'
      }`}
      onClick={() => data.onSelect(p.id)}
    >
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left-s" />
      <Handle type="target" position={Position.Left} id="left-t" />
      <Handle type="source" position={Position.Right} id="right-s" />
      <Handle type="target" position={Position.Right} id="right-t" />
      <div className="flex gap-2.5 items-start">
        {p.thumbUrl ? (
          <img src={p.thumbUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-stone-100 shrink-0" />
        )}
        <div className="min-w-0">
          <div className="font-semibold text-sm leading-snug text-stone-900">{personLabel(p)}</div>
          <div className="text-xs text-stone-600 mt-0.5">{formatLifeSpan(p)}</div>
        </div>
      </div>
    </div>
  )
}

const nodeTypes = { person: PersonNode }

const NODE_W = 230
const COUPLE_GAP = 36
const SIBLING_GAP = 72
const GROUP_GAP = 96
const ROW_H = 150

function buildGraphMaps(data: TreeData) {
  const partnerOf = new Map<string, string>()
  const parentsOf = new Map<string, string[]>()
  const siblingsOf = new Map<string, Set<string>>()

  for (const e of data.edges) {
    if (e.kind === 'partner') {
      partnerOf.set(e.source, e.target)
      partnerOf.set(e.target, e.source)
    } else if (e.kind === 'parent') {
      const list = parentsOf.get(e.target) ?? []
      list.push(e.source)
      parentsOf.set(e.target, list)
    } else if (e.kind === 'sibling') {
      if (!siblingsOf.has(e.source)) siblingsOf.set(e.source, new Set())
      if (!siblingsOf.has(e.target)) siblingsOf.set(e.target, new Set())
      siblingsOf.get(e.source)!.add(e.target)
      siblingsOf.get(e.target)!.add(e.source)
    }
  }

  return { partnerOf, parentsOf, siblingsOf }
}

function clusterRow(
  rowNodes: TreeNode[],
  partnerOf: Map<string, string>,
  siblingsOf: Map<string, Set<string>>
): TreeNode[][] {
  const idSet = new Set(rowNodes.map((n) => n.id))
  const visited = new Set<string>()
  const groups: TreeNode[][] = []

  for (const n of rowNodes) {
    if (visited.has(n.id)) continue
    const group: TreeNode[] = []
    const queue = [n.id]
    visited.add(n.id)

    while (queue.length > 0) {
      const id = queue.shift()!
      const node = rowNodes.find((x) => x.id === id)
      if (!node) continue
      group.push(node)

      const partnerId = partnerOf.get(id)
      if (partnerId && idSet.has(partnerId) && !visited.has(partnerId)) {
        visited.add(partnerId)
        queue.push(partnerId)
      }

      for (const sid of siblingsOf.get(id) ?? []) {
        if (idSet.has(sid) && !visited.has(sid)) {
          visited.add(sid)
          queue.push(sid)
        }
      }
    }

    groups.push(group)
  }

  return groups
}

function orderGroup(group: TreeNode[], partnerOf: Map<string, string>): TreeNode[] {
  const sorted = [...group].sort((a, b) => personLabel(a.person).localeCompare(personLabel(b.person), 'ru'))
  const ordered: TreeNode[] = []
  const used = new Set<string>()

  for (const n of sorted) {
    if (used.has(n.id)) continue
    ordered.push(n)
    used.add(n.id)
    const partnerId = partnerOf.get(n.id)
    const partner = group.find((x) => x.id === partnerId)
    if (partner && !used.has(partner.id)) {
      ordered.push(partner)
      used.add(partner.id)
    }
  }

  return ordered
}

function groupAnchorX(group: TreeNode[], parentsOf: Map<string, string[]>, positions: Map<string, { x: number; y: number }>): number | null {
  const xs: number[] = []
  for (const n of group) {
    for (const pid of parentsOf.get(n.id) ?? []) {
      const p = positions.get(pid)
      if (p) xs.push(p.x)
    }
  }
  if (xs.length === 0) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function placeOrderedGroup(
  ordered: TreeNode[],
  y: number,
  anchorX: number | null,
  partnerOf: Map<string, string>,
  positions: Map<string, { x: number; y: number }>,
  startX: number
): number {
  const rel: number[] = []
  let x = 0
  for (let i = 0; i < ordered.length; i++) {
    if (i > 0) {
      const prev = ordered[i - 1]
      const gap = partnerOf.get(prev.id) === ordered[i].id ? COUPLE_GAP : SIBLING_GAP
      x += NODE_W + gap
    }
    rel.push(x)
  }

  const center = (rel[0] + rel[rel.length - 1]) / 2
  const offset = anchorX != null ? anchorX - center : startX - rel[0]

  for (let i = 0; i < ordered.length; i++) {
    positions.set(ordered[i].id, { x: rel[i] + offset, y })
  }

  const right = rel[rel.length - 1] + offset + NODE_W
  return anchorX != null ? right : right + GROUP_GAP
}

function layoutPositions(data: TreeData): Map<string, { x: number; y: number }> {
  const { partnerOf, parentsOf, siblingsOf } = buildGraphMaps(data)
  const positions = new Map<string, { x: number; y: number }>()
  const gens = [...new Set(data.nodes.map((n) => n.generation))].sort((a, b) => a - b)

  for (const g of gens) {
    const rowNodes = data.nodes.filter((n) => n.generation === g)
    const groups = clusterRow(rowNodes, partnerOf, siblingsOf)
    groups.sort((a, b) => {
      const ax = groupAnchorX(a, parentsOf, positions)
      const bx = groupAnchorX(b, parentsOf, positions)
      if (ax != null && bx != null && ax !== bx) return ax - bx
      if (ax != null) return -1
      if (bx != null) return 1
      return personLabel(a[0].person).localeCompare(personLabel(b[0].person), 'ru')
    })

    let cursor = 0
    for (const group of groups) {
      const ordered = orderGroup(group, partnerOf)
      const anchor = groupAnchorX(group, parentsOf, positions)
      cursor = placeOrderedGroup(ordered, g * ROW_H, anchor, partnerOf, positions, cursor)
    }

    const rowXs = rowNodes.map((n) => positions.get(n.id)?.x ?? 0)
    if (rowXs.length > 0) {
      const center = (Math.min(...rowXs) + Math.max(...rowXs)) / 2
      for (const n of rowNodes) {
        const p = positions.get(n.id)!
        positions.set(n.id, { x: p.x - center, y: p.y })
      }
    }
  }

  return positions
}

export function TreeView({ data, onSelectPerson }: Props) {
  const layout = useMemo(() => {
    const positions = layoutPositions(data)
    const nodes: Node[] = data.nodes.map((n) => ({
      id: n.id,
      type: 'person',
      position: positions.get(n.id) ?? { x: 0, y: 0 },
      data: { person: n.person, isFocus: n.id === data.focusPersonId, onSelect: onSelectPerson },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top
    }))

    const edges: Edge[] = data.edges
      .filter((e) => e.kind !== 'sibling')
      .map((e) => {
        const sourcePos = positions.get(e.source)
        const targetPos = positions.get(e.target)
        const sourceOnLeft = (sourcePos?.x ?? 0) <= (targetPos?.x ?? 0)
        const isPartner = e.kind === 'partner'
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: isPartner ? (sourceOnLeft ? 'right-s' : 'left-s') : 'bottom',
          targetHandle: isPartner ? (sourceOnLeft ? 'left-t' : 'right-t') : 'top',
          type: isPartner ? 'straight' : 'smoothstep',
          style: isPartner
            ? { stroke: '#78716c', strokeWidth: 2.5, strokeDasharray: '7 5' }
            : { stroke: '#44403c', strokeWidth: 2.5 },
          markerEnd: isPartner
            ? undefined
            : { type: MarkerType.ArrowClosed, color: '#44403c', width: 16, height: 16 }
        }
      })

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
        onNodeClick={(_, node) => onSelectPerson(node.id)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        nodesDraggable={false}
        nodesConnectable={false}
        defaultEdgeOptions={{ interactionWidth: 24 }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}
