import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { TFunction } from 'i18next';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { AppLocale, TreeData, Person, TreeFamily, TreeNode } from '@shared/types';
import i18n from '../i18n';
import {
  layoutPedigreeTree,
  buildFamilyConnectors,
  familyConnectorSegments,
  standalonePartnerPairs,
  partnerLineCoords,
  buildPedigreeNodeWidths,
  compactNameLines,
  TREE_LINE_STYLES,
  PEDIGREE_CARD_H,
  type TreeLineSegment
} from '@shared/tree-layout';
import { defaultTreeFocusId } from '@shared/tree-graph';
import { personLabel, personLabelEn, personInitials, formatLifeSpan } from '../lib/labels';

interface Props {
  locale: AppLocale;
  data: TreeData;
  selectedId: string | null;
  onSelectPerson: (id: string | null) => void;
  /** When true (e.g. settings modal open), ignore Escape deselection. */
  suppressDeselect?: boolean;
}

interface PersonNodeData {
  person: Person;
  cardWidth: number;
  isFocus: boolean;
  isSelected: boolean;
  hint: string | null;
  lifeSpan: string;
  emptyNameLabel: string;
  locale: AppLocale;
  onSelect: (id: string) => void;
}

function TreeAvatar({ person, size }: { person: Person; size: 'sm' | 'lg' }) {
  const box = size === 'sm' ? 'w-8 h-8 rounded-md' : 'w-12 h-12 rounded-lg';
  if (person.thumbUrl) {
    return <img src={person.thumbUrl} alt="" className={`${box} object-cover shrink-0`} />;
  }
  return (
    <div className={`${box} shrink-0 bg-stone-200 text-stone-600 flex items-center justify-center text-[11px] font-medium leading-none`} aria-hidden>
      {personInitials(person)}
    </div>
  );
}

function personHasName(person: Person): boolean {
  return [person.lastName, person.firstName, person.middleName].some((part) => part?.trim());
}

function CompactCard({
  person,
  isFocus,
  isSelected,
  lifeSpan,
  emptyNameLabel
}: {
  person: Person;
  isFocus: boolean;
  isSelected: boolean;
  lifeSpan: string;
  emptyNameLabel: string;
}) {
  const { primary, secondary, english } = compactNameLines(person, emptyNameLabel);
  const displayPrimary = personHasName(person) ? primary : emptyNameLabel;
  return (
    <div
      className={`w-full h-full px-2 py-1.5 bg-white rounded-lg text-left flex gap-2 items-center transition-colors ${
        isSelected ? 'opacity-0 pointer-events-none' : isFocus ? 'border-2 border-stone-700' : 'border border-stone-300 hover:border-stone-400'
      }`}
    >
      <TreeAvatar person={person} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium leading-[1.15] text-stone-900 whitespace-nowrap">{displayPrimary}</div>
        {secondary ? <div className="text-[11px] leading-[1.15] text-stone-800 whitespace-nowrap">{secondary}</div> : null}
        {english ? <div className="text-[10px] leading-[1.15] text-stone-500 whitespace-nowrap">{english}</div> : null}
        <div className="text-[10px] tabular-nums text-stone-500 leading-tight mt-0.5 whitespace-nowrap">{lifeSpan}</div>
      </div>
    </div>
  );
}

function ExpandedCard({
  person,
  hint,
  cardWidth,
  lifeSpan,
  emptyNameLabel
}: {
  person: Person;
  hint: string | null;
  cardWidth: number;
  lifeSpan: string;
  emptyNameLabel: string;
}) {
  const en = personLabelEn(person);
  const title = personHasName(person) ? personLabel(person) : emptyNameLabel;
  return (
    <div className="px-2 py-1.5 bg-white rounded-lg border-2 border-stone-800 shadow-md text-left" style={{ width: cardWidth }}>
      <div className="flex gap-2 items-start">
        <TreeAvatar person={person} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="font-serif font-semibold text-[12px] leading-snug text-stone-900">{title}</div>
          {en ? <div className="text-[10px] leading-snug text-stone-500">{en}</div> : null}
          <div className="text-[10px] tabular-nums text-stone-500 mt-0.5">{lifeSpan}</div>
          {hint ? <div className="text-[11px] text-stone-500 mt-1">{hint}</div> : null}
        </div>
      </div>
    </div>
  );
}

function PersonNode({ data }: { data: PersonNodeData }) {
  return (
    <div className="relative cursor-pointer" style={{ width: data.cardWidth, height: PEDIGREE_CARD_H }} onClick={() => data.onSelect(data.person.id)}>
      <CompactCard
        person={data.person}
        isFocus={data.isFocus}
        isSelected={data.isSelected}
        lifeSpan={data.lifeSpan}
        emptyNameLabel={data.emptyNameLabel}
      />
      {data.isSelected ? (
        <div className="absolute left-0 top-0 z-20 pointer-events-auto">
          <ExpandedCard
            person={data.person}
            hint={data.hint}
            cardWidth={data.cardWidth}
            lifeSpan={data.lifeSpan}
            emptyNameLabel={data.emptyNameLabel}
          />
        </div>
      ) : null}
    </div>
  );
}

const nodeTypes = { person: PersonNode };

function extractPartnerPairs(data: TreeData): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const e of data.edges) {
    if (e.kind === 'partner') {
      pairs.push([e.source, e.target]);
    }
  }
  return pairs;
}

function childCount(personId: string, families: TreeFamily[]): number {
  let count = 0;
  for (const family of families) {
    if (family.partners.includes(personId)) {
      count += family.children.length;
    }
  }
  return count;
}

function relationHint(t: TFunction, node: TreeNode, focusId: string | null, data: TreeData): string | null {
  const children = childCount(node.id, data.families);
  const childPart = children > 0 ? t('treeHint.childCount', { count: children }) : null;

  if (!focusId) {
    return childPart;
  }
  if (node.id === focusId) {
    return childPart;
  }

  if (node.type === 'ancestor') {
    const isParent = data.edges.some((e) => e.kind === 'parent' && e.source === node.id && e.target === focusId);
    if (isParent) {
      if (node.person.sex === 'female') {
        return childPart ? `${t('treeHint.mother')} · ${childPart}` : t('treeHint.mother');
      }
      if (node.person.sex === 'male') {
        return childPart ? `${t('treeHint.father')} · ${childPart}` : t('treeHint.father');
      }
      return childPart ? `${t('treeHint.parent')} · ${childPart}` : t('treeHint.parent');
    }
    return childPart ? `${t('treeHint.ancestor')} · ${childPart}` : t('treeHint.ancestor');
  }

  if (node.type === 'descendant') {
    const isChild = data.edges.some((e) => e.kind === 'parent' && e.source === focusId && e.target === node.id);
    if (isChild) {
      return childPart ? `${t('treeHint.child')} · ${childPart}` : t('treeHint.child');
    }
    return childPart ? `${t('treeHint.descendant')} · ${childPart}` : t('treeHint.descendant');
  }

  const isPartner = data.edges.some(
    (e) => e.kind === 'partner' && ((e.source === focusId && e.target === node.id) || (e.target === focusId && e.source === node.id))
  );
  if (isPartner) {
    return childPart ? `${t('treeHint.spouse')} · ${childPart}` : t('treeHint.spouse');
  }

  return childPart;
}

function RelationshipLayer({ segments }: { segments: TreeLineSegment[] }) {
  return (
    <ViewportPortal>
      <svg width={1} height={1} style={{ position: 'absolute', overflow: 'visible', pointerEvents: 'none', zIndex: 0 }}>
        {segments.map((segment) => {
          const style = TREE_LINE_STYLES[segment.kind];
          return (
            <line
              key={segment.id}
              x1={segment.x1}
              y1={segment.y1}
              x2={segment.x2}
              y2={segment.y2}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              strokeDasharray={style.strokeDasharray ?? 'none'}
              strokeLinecap={style.strokeLinecap}
            />
          );
        })}
      </svg>
    </ViewportPortal>
  );
}

function FocusViewport({ focusId }: { focusId: string | null }) {
  const { setCenter, getNode, fitView } = useReactFlow();

  useEffect(() => {
    if (!focusId) {
      void fitView({ padding: 0.2, duration: 200 });
      return;
    }
    const node = getNode(focusId);
    if (!node) {
      void fitView({ padding: 0.2, duration: 200 });
      return;
    }
    const width = typeof node.style?.width === 'number' ? node.style.width : Number(node.style?.width) || node.measured?.width || 148;
    const x = node.position.x + width / 2;
    const y = node.position.y + PEDIGREE_CARD_H / 2;
    void setCenter(x, y, { zoom: 1, duration: 200 });
  }, [focusId, getNode, setCenter, fitView]);

  return null;
}

function TreeCanvas({ locale, data, selectedId, onSelectPerson, suppressDeselect = false }: Props) {
  const onSelectRef = useRef(onSelectPerson);
  onSelectRef.current = onSelectPerson;
  const stableSelect = useCallback((id: string) => {
    onSelectRef.current(id);
  }, []);

  const layout = useMemo(() => {
    // getFixedT(locale) — явный язык карточек; useLocale ждёт changeLanguage до setState.
    const t = i18n.getFixedT(locale);
    const emptyNameLabel = t('enum.newPerson');
    const nodeIds = data.nodes.map((n) => n.id);
    const partnerPairs = extractPartnerPairs(data);
    const families = data.families ?? [];
    const nodeWidths = buildPedigreeNodeWidths(
      data.nodes.map((n) => ({ ...n.person, id: n.id })),
      emptyNameLabel
    );

    const layoutFocus =
      data.focusPersonId ??
      defaultTreeFocusId(
        nodeIds,
        families.flatMap((family) => family.children)
      ) ??
      data.nodes[0]?.id ??
      undefined;

    const positions = layoutPedigreeTree({
      nodeIds,
      focusId: layoutFocus,
      families,
      partnerPairs,
      nodeWidths
    });

    const connectors = buildFamilyConnectors(families, positions, nodeWidths);
    const lineSegments: TreeLineSegment[] = connectors.flatMap((connector) => familyConnectorSegments(connector, nodeWidths));

    for (const [a, b] of standalonePartnerPairs(partnerPairs, families)) {
      const pa = positions.get(a);
      const pb = positions.get(b);
      if (!pa || !pb || Math.abs(pa.y - pb.y) > 1) {
        continue;
      }
      const coords = partnerLineCoords(pa, pb, nodeWidths.get(a)!, nodeWidths.get(b)!);
      if (coords.x2 - coords.x1 < 1) {
        continue;
      }
      lineSegments.push({
        id: `partner-${a}|${b}`,
        kind: 'partner',
        ...coords
      });
    }

    const nodes: Node[] = data.nodes.map((n) => {
      const pos = positions.get(n.id) ?? { x: 0, y: 0 };
      const cardWidth = nodeWidths.get(n.id)!;
      return {
        id: n.id,
        type: 'person',
        position: { x: pos.x - cardWidth / 2, y: pos.y },
        data: {
          person: n.person,
          cardWidth,
          isFocus: layoutFocus != null && n.id === layoutFocus,
          isSelected: n.id === selectedId,
          hint: relationHint(t, n, layoutFocus ?? null, data),
          lifeSpan: formatLifeSpan(n.person, t),
          emptyNameLabel,
          locale,
          onSelect: stableSelect
        } satisfies PersonNodeData,
        draggable: false,
        style: { width: cardWidth, zIndex: n.id === selectedId ? 30 : layoutFocus === n.id ? 10 : 2 }
      };
    });

    return { nodes, lineSegments, viewportFocusId: layoutFocus ?? null };
  }, [locale, data, selectedId, stableSelect]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, , onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    setNodes(layout.nodes);
  }, [layout, setNodes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (suppressDeselect) {
        return;
      }
      if (e.key === 'Escape' && selectedId) {
        onSelectPerson(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, onSelectPerson, suppressDeselect]);

  return (
    <div className="h-full w-full bg-[#f4f1eb] rounded-lg border border-stone-200 tree-view">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onSelectPerson(node.id)}
        nodeTypes={nodeTypes}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <RelationshipLayer segments={layout.lineSegments} />
        <Background color="#a8a29e" gap={24} size={1} />
        <Controls showInteractive={false} className="tree-controls" />
        <FocusViewport focusId={layout.viewportFocusId} />
      </ReactFlow>
    </div>
  );
}

export function TreeView(props: Props) {
  return (
    <ReactFlowProvider>
      {/* Remount canvas on locale so React Flow rebuilds memoized node labels. */}
      <TreeCanvas key={props.locale} {...props} />
    </ReactFlowProvider>
  );
}
