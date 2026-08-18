import { useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  ViewportPortal,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { TreeData, Person, TreeFamily, TreeNode } from '@shared/types'
import {
  layoutPedigreeTree,
  buildFamilyConnectors,
  familyConnectorPath,
  standalonePartnerPairs,
  partnerLineCoords,
  buildPedigreeNodeWidths,
  compactNameLines,
  estimatePedigreeCardWidth,
  PEDIGREE_CARD_H
} from '@shared/tree-layout'
import { personLabel, personInitials, formatLifeSpan } from '../lib/labels'

interface Props {
  data: TreeData
  selectedId: string | null
  onSelectPerson: (id: string | null) => void
}

interface PersonNodeData {
  person: Person
  cardWidth: number
  isFocus: boolean
  isSelected: boolean
  hint: string | null
  onSelect: (id: string) => void
}

function TreeAvatar({ person, size }: { person: Person; size: 'sm' | 'lg' }) {
  const box = size === 'sm' ? 'w-8 h-8 rounded-md' : 'w-12 h-12 rounded-lg'
  if (person.thumbUrl) {
    return <img src={person.thumbUrl} alt="" className={`${box} object-cover shrink-0`} />
  }
  return (
    <div
      className={`${box} shrink-0 bg-stone-200 text-stone-600 flex items-center justify-center text-[11px] font-medium leading-none`}
      aria-hidden
    >
      {personInitials(person)}
    </div>
  )
}

function CompactCard({ person, isFocus, isSelected }: { person: Person; isFocus: boolean; isSelected: boolean }) {
  const { primary, secondary } = compactNameLines(person)
  return (
    <div
      className={`w-full h-full px-2 py-1.5 bg-white rounded-lg text-left flex gap-2 items-center transition-colors ${
        isSelected
          ? 'opacity-0 pointer-events-none'
          : isFocus
            ? 'border-2 border-stone-700'
            : 'border border-stone-300 hover:border-stone-400'
      }`}
    >
      <TreeAvatar person={person} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium leading-[1.15] text-stone-900 whitespace-nowrap">{primary}</div>
        {secondary ? (
          <div className="text-[11px] leading-[1.15] text-stone-800 whitespace-nowrap">{secondary}</div>
        ) : null}
        <div className="text-[10px] tabular-nums text-stone-500 leading-tight mt-0.5 whitespace-nowrap">{formatLifeSpan(person)}</div>
      </div>
    </div>
  )
}

function ExpandedCard({ person, hint }: { person: Person; hint: string | null }) {
  const cardWidth = Math.max(208, estimatePedigreeCardWidth(compactNameLines(person)) + 24)
  return (
    <div
      className="px-3 py-2.5 bg-white rounded-xl border-2 border-stone-800 shadow-md text-left"
      style={{ width: cardWidth }}
    >
      <div className="flex gap-2.5 items-start">
        <TreeAvatar person={person} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="font-serif font-semibold text-sm leading-snug text-stone-900 whitespace-nowrap">{personLabel(person)}</div>
          <div className="text-xs tabular-nums text-stone-500 mt-0.5">{formatLifeSpan(person)}</div>
          {hint ? <div className="text-[11px] text-stone-500 mt-1">{hint}</div> : null}
        </div>
      </div>
    </div>
  )
}

function PersonNode({ data }: { data: PersonNodeData }) {
  return (
    <div
      className="relative cursor-pointer"
      style={{ width: data.cardWidth, height: PEDIGREE_CARD_H }}
      onClick={() => data.onSelect(data.person.id)}
    >
      <CompactCard person={data.person} isFocus={data.isFocus} isSelected={data.isSelected} />
      {data.isSelected ? (
        <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 pointer-events-auto">
          <ExpandedCard person={data.person} hint={data.hint} />
        </div>
      ) : null}
    </div>
  )
}

const nodeTypes = { person: PersonNode }

function extractPartnerPairs(data: TreeData): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  for (const e of data.edges) {
    if (e.kind === 'partner') pairs.push([e.source, e.target])
  }
  return pairs
}

function childCount(personId: string, families: TreeFamily[]): number {
  let count = 0
  for (const family of families) {
    if (family.partners.includes(personId)) count += family.children.length
  }
  return count
}

function relationHint(node: TreeNode, focusId: string, data: TreeData): string | null {
  const children = childCount(node.id, data.families)
  const childPart = children > 0 ? `${children} ${children === 1 ? 'ребёнок' : children < 5 ? 'ребёнка' : 'детей'}` : null

  if (node.id === focusId) return childPart

  if (node.type === 'ancestor') {
    const isParent = data.edges.some((e) => e.kind === 'parent' && e.source === node.id && e.target === focusId)
    if (isParent) {
      if (node.person.sex === 'female') return childPart ? `Мать · ${childPart}` : 'Мать'
      if (node.person.sex === 'male') return childPart ? `Отец · ${childPart}` : 'Отец'
      return childPart ? `Родитель · ${childPart}` : 'Родитель'
    }
    return childPart ? `Предок · ${childPart}` : 'Предок'
  }

  if (node.type === 'descendant') {
    const isChild = data.edges.some((e) => e.kind === 'parent' && e.source === focusId && e.target === node.id)
    if (isChild) return childPart ? `Ребёнок · ${childPart}` : 'Ребёнок'
    return childPart ? `Потомок · ${childPart}` : 'Потомок'
  }

  const isPartner = data.edges.some(
    (e) => e.kind === 'partner' && ((e.source === focusId && e.target === node.id) || (e.target === focusId && e.source === node.id))
  )
  if (isPartner) return childPart ? `Супруг(а) · ${childPart}` : 'Супруг(а)'

  return childPart
}

function RelationshipLayer({
  connectors,
  partnerLines
}: {
  connectors: ReturnType<typeof buildFamilyConnectors>
  partnerLines: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }>
}) {
  return (
    <ViewportPortal>
      <svg
        width={1}
        height={1}
        style={{ position: 'absolute', overflow: 'visible', pointerEvents: 'none', zIndex: 0 }}
      >
        {connectors.map((connector) => (
          <path
            key={connector.familyId}
            d={familyConnectorPath(connector)}
            fill="none"
            stroke="#78716c"
            strokeWidth={1.5}
            strokeLinecap="square"
          />
        ))}
        {partnerLines.map((line) => (
          <line
            key={line.id}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#a8a29e"
            strokeWidth={1.5}
            strokeLinecap="square"
          />
        ))}
      </svg>
    </ViewportPortal>
  )
}

function FocusViewport({ focusId }: { focusId: string }) {
  const { setCenter, getNode } = useReactFlow()

  useEffect(() => {
    const node = getNode(focusId)
    if (!node) return
    const width = typeof node.style?.width === 'number' ? node.style.width : Number(node.style?.width) || node.measured?.width || 148
    const x = node.position.x + width / 2
    const y = node.position.y + PEDIGREE_CARD_H / 2
    void setCenter(x, y, { zoom: 1, duration: 200 })
  }, [focusId, getNode, setCenter])

  return null
}

function TreeCanvas({ data, selectedId, onSelectPerson }: Props) {
  const layout = useMemo(() => {
    const nodeIds = data.nodes.map((n) => n.id)
    const partnerPairs = extractPartnerPairs(data)
    const families = data.families ?? []
    const nodeWidths = buildPedigreeNodeWidths(data.nodes.map((n) => ({ id: n.id, ...n.person })))

    const positions = layoutPedigreeTree({
      nodeIds,
      focusId: data.focusPersonId,
      families,
      partnerPairs,
      nodeWidths
    })

    const connectors = buildFamilyConnectors(families, positions)

    const partnerLines = standalonePartnerPairs(partnerPairs, families).flatMap(([a, b]) => {
      const pa = positions.get(a)
      const pb = positions.get(b)
      if (!pa || !pb) return []
      return [{ id: `${a}|${b}`, ...partnerLineCoords(pa, pb, nodeWidths.get(a)!, nodeWidths.get(b)!) }]
    })

    const nodes: Node[] = data.nodes.map((n) => {
      const pos = positions.get(n.id) ?? { x: 0, y: 0 }
      const cardWidth = nodeWidths.get(n.id)!
      return {
        id: n.id,
        type: 'person',
        position: { x: pos.x - cardWidth / 2, y: pos.y },
        data: {
          person: n.person,
          cardWidth,
          isFocus: n.id === data.focusPersonId,
          isSelected: n.id === selectedId,
          hint: relationHint(n, data.focusPersonId, data),
          onSelect: onSelectPerson
        },
        draggable: false,
        style: { width: cardWidth, zIndex: n.id === selectedId ? 30 : n.id === data.focusPersonId ? 10 : 2 }
      }
    })

    return { nodes, connectors, partnerLines }
  }, [data, selectedId, onSelectPerson])

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes)
  const [edges, , onEdgesChange] = useEdgesState([])

  useEffect(() => {
    setNodes(layout.nodes)
  }, [layout, setNodes])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedId) onSelectPerson(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, onSelectPerson])

  return (
    <div className="h-full w-full bg-[#f4f1eb] rounded-lg border border-stone-200 tree-view">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onSelectPerson(node.id)}
        onPaneClick={() => {
          if (selectedId) onSelectPerson(null)
        }}
        nodeTypes={nodeTypes}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <RelationshipLayer connectors={layout.connectors} partnerLines={layout.partnerLines} />
        <Background color="#a8a29e" gap={24} size={1} />
        <Controls showInteractive={false} className="tree-controls" />
        <FocusViewport focusId={data.focusPersonId} />
      </ReactFlow>
    </div>
  )
}

export function TreeView(props: Props) {
  return (
    <ReactFlowProvider>
      <TreeCanvas {...props} />
    </ReactFlowProvider>
  )
}
