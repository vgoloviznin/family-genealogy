import { useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ViewportPortal,
  useNodesState,
  useEdgesState,
  type Node
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { TreeData, Person } from '@shared/types'
import {
  layoutPedigreeTree,
  buildFamilyConnectors,
  familyConnectorPath,
  standalonePartnerPairs,
  partnerLineCoords,
  PEDIGREE_NODE_W
} from '@shared/tree-layout'
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

function extractPartnerPairs(data: TreeData): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  for (const e of data.edges) {
    if (e.kind === 'partner') pairs.push([e.source, e.target])
  }
  return pairs
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
            stroke="#57534e"
            strokeWidth={2}
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
            stroke="#78716c"
            strokeWidth={2}
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
        ))}
      </svg>
    </ViewportPortal>
  )
}

export function TreeView({ data, onSelectPerson }: Props) {
  const layout = useMemo(() => {
    const nodeIds = data.nodes.map((n) => n.id)
    const partnerPairs = extractPartnerPairs(data)
    const families = data.families ?? []

    const positions = layoutPedigreeTree({
      nodeIds,
      focusId: data.focusPersonId,
      families,
      partnerPairs
    })

    const connectors = buildFamilyConnectors(families, positions)

    const partnerLines = standalonePartnerPairs(partnerPairs, families).flatMap(([a, b]) => {
      const pa = positions.get(a)
      const pb = positions.get(b)
      if (!pa || !pb) return []
      return [{ id: `${a}|${b}`, ...partnerLineCoords(pa, pb) }]
    })

    const nodes: Node[] = data.nodes.map((n) => {
      const pos = positions.get(n.id) ?? { x: 0, y: 0 }
      return {
        id: n.id,
        type: 'person',
        position: { x: pos.x - PEDIGREE_NODE_W / 2, y: pos.y },
        data: { person: n.person, isFocus: n.id === data.focusPersonId, onSelect: onSelectPerson },
        draggable: false,
        style: { zIndex: 2 }
      }
    })

    return { nodes, connectors, partnerLines }
  }, [data, onSelectPerson])

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes)
  const [edges, , onEdgesChange] = useEdgesState([])

  useEffect(() => {
    setNodes(layout.nodes)
  }, [layout, setNodes])

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
        fitViewOptions={{ padding: 0.35 }}
        minZoom={0.12}
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <RelationshipLayer connectors={layout.connectors} partnerLines={layout.partnerLines} />
        <Background gap={20} size={1} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}
