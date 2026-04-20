import {
    IconAlertHexagon,
    IconCircleCheck,
    IconExclamationCircle,
    IconHelpHexagon,
    IconPoint,
} from "@tabler/icons-react";

export type PermissionDebugTrace = {
    resource?: {
        objectType?: string;
        object_type?: string;
        objectId?: string;
        object_id?: string;
    };
    permission?: string;
    permissionType?: string | number;
    subject?: {
        object?: {
            objectType?: string;
            object_type?: string;
            objectId?: string;
            object_id?: string;
        };
        optionalRelation?: string;
        optional_relation?: string;
    };
    result?: string | number;
    resolution?:
        | {
            oneofKind?: string;
            subProblems?: {
                traces?: PermissionDebugTrace[];
            };
        }
        | {
            case?: string;
            value?: {
                traces?: PermissionDebugTrace[];
            };
        };
    caveatEvaluationInfo?: {
        caveatName?: string;
        result?: string | number | boolean;
        partialCaveatInfo?: {
            missingRequiredContext?: string[];
        };
    };
    source?: string;
    traceOperationId?: string;
};

const getObjectType = (value?: { objectType?: string; object_type?: string }) =>
    value?.objectType || value?.object_type || "unknown";

const getObjectId = (value?: { objectId?: string; object_id?: string }) =>
    value?.objectId || value?.object_id || "unknown";

const getOptionalRelation = (value?: { optionalRelation?: string; optional_relation?: string }) =>
    value?.optionalRelation || value?.optional_relation || "";

const normalizeTraceResult = (value?: string | number) => {
    switch (value) {
        case 2:
        case "2":
        case "HAS_PERMISSION":
        case "PERMISSIONSHIP_HAS_PERMISSION":
            return "HAS_PERMISSION";
        case 1:
        case "1":
        case "NO_PERMISSION":
        case "PERMISSIONSHIP_NO_PERMISSION":
            return "NO_PERMISSION";
        case 3:
        case "3":
        case "CONDITIONAL_PERMISSION":
        case "PERMISSIONSHIP_CONDITIONAL_PERMISSION":
            return "CONDITIONAL_PERMISSION";
        default:
            return "UNKNOWN";
    }
};

const normalizePermissionType = (value?: string | number) => {
    switch (value) {
        case 1:
        case "1":
        case "RELATION":
            return "RELATION";
        case 2:
        case "2":
        case "PERMISSION":
            return "PERMISSION";
        default:
            return "UNKNOWN";
    }
};

const getTraceChildren = (trace: PermissionDebugTrace) => {
    const resolution = trace.resolution;

    if (!resolution) {
        return [] as PermissionDebugTrace[];
    }

    if ("oneofKind" in resolution && resolution.oneofKind === "subProblems") {
        return resolution.subProblems?.traces || [];
    }

    if ("case" in resolution && resolution.case === "subProblems") {
        return resolution.value?.traces || [];
    }

    return [] as PermissionDebugTrace[];
};

const getTone = (trace: PermissionDebugTrace) => {
    const result = normalizeTraceResult(trace.result);

    if (result === "HAS_PERMISSION") {
        return {
            icon: <IconCircleCheck className="h-4 w-4 text-green-600" aria-hidden />,
            border: "border-green-200",
            badge: "bg-green-100 text-green-700",
        };
    }

    if (result === "NO_PERMISSION") {
        return {
            icon: <IconExclamationCircle className="h-4 w-4 text-red-600" aria-hidden />,
            border: "border-red-200",
            badge: "bg-red-100 text-red-700",
        };
    }

    if (result === "CONDITIONAL_PERMISSION") {
        return {
            icon: <IconAlertHexagon className="h-4 w-4 text-amber-600" aria-hidden />,
            border: "border-amber-200",
            badge: "bg-amber-100 text-amber-700",
        };
    }

    return {
        icon: <IconHelpHexagon className="h-4 w-4 text-slate-500" aria-hidden />,
        border: "border-slate-200",
        badge: "bg-slate-100 text-slate-700",
    };
};

const SubjectLeaf = ({ trace, depth, path }: { trace: PermissionDebugTrace; depth: number; path: string }) => {
    const subject = trace.subject?.object;
    if (!subject) {
        return null;
    }

    const relation = getOptionalRelation(trace.subject);

    return (
        <div className="flex items-start gap-2" style={{ paddingLeft: `${depth * 1.25}rem` }}>
            <IconPoint className="mt-1 h-4 w-4 text-slate-400" aria-hidden />
            <div className="min-w-0" key={`${path}-subject`}>
                <div>
                    {getObjectType(subject)}:{getObjectId(subject)}
                    {relation ? `#${relation}` : ""}
                </div>
                <div>Subject reached by this relation</div>
            </div>
        </div>
    );
};

function TraceNode({ trace, depth, path }: { trace: PermissionDebugTrace; depth: number; path: string }) {
    const tone = getTone(trace);
    const children = getTraceChildren(trace);
    const resourceIds = getObjectId(trace.resource)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

    return (
        <div className="space-y-2">
            {resourceIds.map((resourceId, index) => {
                const nodePath = `${path}-${index}`;

                return (
                    <div key={nodePath} className="space-y-2">
                        <div className="flex items-start gap-2" style={{ paddingLeft: `${depth * 1.25}rem` }}>
                            <div className={`mt-0.5 rounded-full border p-1 ${tone.border}`}>
                                {tone.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span>
                                        <span>{getObjectType(trace.resource)}</span>:{resourceId}
                                        <span>#{trace.permission || "unknown"}</span>
                                    </span>
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone.badge}`}>
                                        {normalizePermissionType(trace.permissionType)}
                                    </span>
                                </div>
                                {trace.source && <div>Source: {trace.source}</div>}
                                {trace.caveatEvaluationInfo?.caveatName && (
                                    <div>
                                        Caveat: {trace.caveatEvaluationInfo.caveatName}
                                    </div>
                                )}
                            </div>
                        </div>

                        {children.map((child, childIndex) => (
                            <TraceNode
                                key={`${nodePath}-${childIndex}`}
                                trace={child}
                                depth={depth + 1}
                                path={`${nodePath}-${childIndex}`}
                            />
                        ))}

                        {children.length === 0 && normalizePermissionType(trace.permissionType) === "RELATION" && (
                            <SubjectLeaf trace={trace} depth={depth + 1} path={nodePath} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default function PermissionDecisionTree({ trace }: { trace: PermissionDebugTrace }) {
    return (
        <div className="mt-3 rounded-lg border border-slate-200 p-4">
            <div className="mb-3">Decision Tree</div>
            <TraceNode trace={trace} depth={0} path="trace" />
        </div>
    );
}