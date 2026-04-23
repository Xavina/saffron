import dagre from "@dagrejs/dagre";
import {
  BaseEdge,
  Background,
  Controls,
  Edge,
  EdgeLabelRenderer,
  EdgeProps,
  EdgeTypes,
  getBezierPath,
  MarkerType,
  MiniMap,
  Node,
  ReactFlow,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo } from "react";

export interface SchemaGraphProps {
  schemaText: string;
}

const MAX_VISIBLE_RELATIONS = 3;
const SCHEMA_GRAPH_LAYOUTS_STORAGE_KEY = "saffron.schema-graph.layouts.v1";

type SchemaEdgeData = {
  relationLabels: string[];
};

type NodePosition = {
  x: number;
  y: number;
};

type StoredLayout = Record<string, NodePosition>;
type StoredLayouts = Record<string, StoredLayout>;

type SchemaTypeRef = {
  path: string;
  relationName?: string;
  wildcard?: boolean;
};

type SchemaRelation = {
  name: string;
  allowedTypes: {
    types: SchemaTypeRef[];
  };
};

type SchemaDefinition = {
  kind: "objectDef";
  name: string;
  relations: SchemaRelation[];
};

function extractDefinitionBlock(definitionName: string, schemaText: string): string {
  const startRegex = new RegExp(`definition\\s+${definitionName}\\s*\\{`);
  const startMatch = schemaText.match(startRegex);
  if (!startMatch || startMatch.index === undefined) {
    return "";
  }

  const startIndex = startMatch.index + startMatch[0].length;
  let braceCount = 1;
  let endIndex = startIndex;

  for (let i = startIndex; i < schemaText.length && braceCount > 0; i++) {
    if (schemaText[i] === "{") {
      braceCount++;
    }
    if (schemaText[i] === "}") {
      braceCount--;
    }
    endIndex = i;
  }

  return schemaText.substring(startIndex, endIndex);
}

function parseAllowedType(typeText: string): SchemaTypeRef | undefined {
  const cleaned = typeText.replace(/\s+/g, "").trim();
  if (!cleaned) {
    return undefined;
  }

  if (cleaned.includes("*") && !cleaned.includes(":") && !cleaned.includes("#")) {
    return undefined;
  }

  const wildcardMatch = cleaned.match(/^([a-zA-Z_][\w]*)\:\*$/);
  if (wildcardMatch) {
    return { path: wildcardMatch[1], wildcard: true };
  }

  const relationMatch = cleaned.match(/^([a-zA-Z_][\w]*)#([a-zA-Z_][\w]*)$/);
  if (relationMatch) {
    return { path: relationMatch[1], relationName: relationMatch[2] };
  }

  const directMatch = cleaned.match(/^([a-zA-Z_][\w]*)$/);
  if (directMatch) {
    return { path: directMatch[1] };
  }

  return undefined;
}

function parseDefinitionsFromSchema(schemaText: string): SchemaDefinition[] {
  const definitionRegex = /definition\s+([a-zA-Z_][\w]*)\s*\{/g;
  const relationRegex = /relation\s+([a-zA-Z_][\w]*)\s*:\s*([^\n\r]+)/g;
  const definitions: SchemaDefinition[] = [];

  let definitionMatch: RegExpExecArray | null;
  while ((definitionMatch = definitionRegex.exec(schemaText)) !== null) {
    const definitionName = definitionMatch[1];
    const block = extractDefinitionBlock(definitionName, schemaText);

    const relations: SchemaRelation[] = [];
    let relationMatch: RegExpExecArray | null;
    while ((relationMatch = relationRegex.exec(block)) !== null) {
      const relationName = relationMatch[1];
      const relationTypes = relationMatch[2]
        .split("|")
        .map((item) => item.split("//")[0].trim())
        .filter(Boolean)
        .map(parseAllowedType)
        .filter((item): item is SchemaTypeRef => Boolean(item));

      relations.push({
        name: relationName,
        allowedTypes: {
          types: relationTypes,
        },
      });
    }

    definitions.push({
      kind: "objectDef",
      name: definitionName,
      relations,
    });
  }

  return definitions;
}

function normalizeRelationLabels(labels: string[]): string[] {
  return labels
    .flatMap((label) => label.split("|"))
    .map((label) => label.trim())
    .filter(Boolean);
}

function getRelationColor(relationLabel: string): string {
  const palette = [
    "#1d4ed8",
    "#0f766e",
    "#b45309",
    "#be123c",
    "#6d28d9",
    "#1e40af",
    "#0f766e",
    "#9f1239",
  ];

  let hash = 0;
  for (let i = 0; i < relationLabel.length; i++) {
    hash = (hash * 31 + relationLabel.charCodeAt(i)) >>> 0;
  }

  return palette[hash % palette.length];
}

function getLayoutStorageKey(definitions: SchemaDefinition[]): string {
  if (!definitions.length) {
    return "empty-schema";
  }

  return definitions
    .map((definition) => definition.name)
    .sort()
    .join("|");
}

function readStoredLayouts(): StoredLayouts {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(SCHEMA_GRAPH_LAYOUTS_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed as StoredLayouts;
  } catch {
    return {};
  }
}

function saveStoredLayout(layoutKey: string, layout: StoredLayout) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const currentLayouts = readStoredLayouts();
    const nextLayouts: StoredLayouts = {
      ...currentLayouts,
      [layoutKey]: layout,
    };

    window.localStorage.setItem(SCHEMA_GRAPH_LAYOUTS_STORAGE_KEY, JSON.stringify(nextLayouts));
  } catch {
    // Ignore storage errors and continue with in-memory positions.
  }
}

function applyStoredLayout(nodes: Node[], layout: StoredLayout | undefined): Node[] {
  if (!layout) {
    return nodes;
  }

  return nodes.map((node) => {
    const savedPosition = layout[node.id];
    if (!savedPosition) {
      return node;
    }

    return {
      ...node,
      position: {
        x: savedPosition.x,
        y: savedPosition.y,
      },
    };
  });
}

function SchemaRelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps<Edge<SchemaEdgeData>>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const allLabels = normalizeRelationLabels(data?.relationLabels ?? []);
  const visibleLabels = allLabels.slice(0, MAX_VISIBLE_RELATIONS);
  const hasMore = allLabels.length > MAX_VISIBLE_RELATIONS;

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {!!allLabels.length && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan group absolute z-[9999] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-md"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
              backgroundColor: "#ffffff",
              opacity: 1,
              mixBlendMode: "normal",
            }}
          >
            <div className="space-y-0.5">
              {visibleLabels.map((relationLabel) => (
                <div key={relationLabel} style={{ color: getRelationColor(relationLabel) }}>
                  {relationLabel}
                </div>
              ))}
              {hasMore && <div className="text-slate-500">...</div>}
            </div>

            {hasMore && (
              <div
                className="pointer-events-none absolute left-1/2 top-full z-[10000] mt-2 hidden w-max max-w-[360px] -translate-x-1/2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-xl group-hover:block"
                style={{
                  backgroundColor: "#ffffff",
                  opacity: 1,
                  mixBlendMode: "normal",
                }}
              >
                <div className="mb-1 font-semibold text-slate-900">Relations</div>
                <div className="space-y-0.5">
                  {allLabels.map((relationLabel, idx) => (
                    <div
                      key={`${relationLabel}-${idx}`}
                      style={{ color: getRelationColor(relationLabel) }}
                    >
                      {relationLabel}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes: EdgeTypes = {
  schemaRelation: SchemaRelationEdge,
};

function getNodeColor(name: string): string {
  const palette = [
    "#dbeafe",
    "#dcfce7",
    "#fef3c7",
    "#fee2e2",
    "#ede9fe",
    "#cffafe",
    "#fde68a",
    "#fbcfe8",
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }

  return palette[hash % palette.length];
}

function getLayoutedElements<NodeType extends Node, EdgeType extends Edge>(
  nodes: NodeType[],
  edges: EdgeType[],
) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: "BT",
    ranksep: 120,
    nodesep: 100,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 210, height: 72 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const position = dagreGraph.node(node.id);

    return {
      ...node,
      position: {
        x: position.x - 105,
        y: position.y - 36,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

function generateSchemaEdges(definitions: SchemaDefinition[]): Edge<SchemaEdgeData>[] {
  const edges: Edge<SchemaEdgeData>[] = [];
  const validDefinitions = new Set(definitions.map((def) => def.name));
  let edgeId = 0;

  definitions.forEach((def) => {
    def.relations.forEach((relation) => {
      relation.allowedTypes.types.forEach((typeRef) => {
        if (!validDefinitions.has(typeRef.path)) {
          return;
        }

        let label = relation.name;
        if (typeRef.relationName) {
          label = `${relation.name}: ${typeRef.path}#${typeRef.relationName}`;
        } else if (typeRef.wildcard) {
          label = `${relation.name}: ${typeRef.path}*`;
        }

        edges.push({
          id: `edge-${edgeId++}`,
          type: "schemaRelation",
          source: def.name,
          target: typeRef.path,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: "#64748b", strokeWidth: 1.5 },
          data: { relationLabels: [label] },
        });
      });
    });
  });

  const groups = new Map<string, Edge<SchemaEdgeData>[]>();
  edges.forEach((edge) => {
    const key = `${edge.source}->${edge.target}`;
    const current = groups.get(key) ?? [];
    current.push(edge);
    groups.set(key, current);
  });

  const consolidated: Edge<SchemaEdgeData>[] = [];
  groups.forEach((group) => {
    const relationLabels = group
      .map((edge) => edge.data?.relationLabels ?? [])
      .flat();
    consolidated.push({
      ...group[0],
      data: {
        relationLabels,
      },
    });
  });

  return consolidated;
}

export default function SchemaGraph({ schemaText }: SchemaGraphProps) {
  const definitions = useMemo(() => parseDefinitionsFromSchema(schemaText), [schemaText]);
  const layoutStorageKey = useMemo(() => getLayoutStorageKey(definitions), [definitions]);

  const { nodes, edges }: { nodes: Node[]; edges: Edge<SchemaEdgeData>[] } = useMemo(() => {
    const baseNodes: Node[] = definitions.map((def) => ({
      id: def.name,
      data: { label: def.name },
      position: { x: 0, y: 0 },
      style: {
        background: getNodeColor(def.name),
        border: "1px solid #cbd5e1",
        borderRadius: "10px",
        padding: "8px 10px",
        color: "#0f172a",
        fontWeight: 600,
        minWidth: 180,
        textAlign: "center",
      },
    }));

    const baseEdges = generateSchemaEdges(definitions);
    return getLayoutedElements(baseNodes, baseEdges);
  }, [definitions]);

  const [statefulNodes, setNodesState, onNodesChange] = useNodesState(nodes);

  useEffect(() => {
    const layouts = readStoredLayouts();
    const restoredNodes = applyStoredLayout(nodes, layouts[layoutStorageKey]);
    setNodesState(restoredNodes);
  }, [nodes, layoutStorageKey, setNodesState]);

  const persistNodePositions = useCallback(
    (nodesToPersist: Node[]) => {
      if (!layoutStorageKey) {
        return;
      }

      if (!nodesToPersist.length) {
        return;
      }

      const storedLayouts = readStoredLayouts();
      const currentLayout = storedLayouts[layoutStorageKey] ?? {};

      const mergedLayout = nodesToPersist.reduce<StoredLayout>((result, currentNode) => {
        result[currentNode.id] = {
          x: currentNode.position.x,
          y: currentNode.position.y,
        };
        return result;
      }, { ...currentLayout });

      saveStoredLayout(layoutStorageKey, mergedLayout);
    },
    [layoutStorageKey],
  );

  if (!definitions.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500">
        No schema to visualize. Add schema definitions to see the graph.
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-lg border border-gray-200 bg-white">
      <ReactFlow
        nodes={statefulNodes}
        edges={edges}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={(_event, draggedNode, draggedNodes) => {
          const nodesToPersist = draggedNodes.length ? draggedNodes : [draggedNode];
          persistNodePositions(nodesToPersist);
        }}
        fitView
        attributionPosition="bottom-left"
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) =>
            typeof node.style?.background === "string" ? node.style.background : "#e2e8f0"
          }
          maskColor="rgba(2, 6, 23, 0.06)"
        />
      </ReactFlow>
    </div>
  );
}
