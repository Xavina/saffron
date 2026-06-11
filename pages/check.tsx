import type { NextPage } from "next";
import { JSX, useState } from "react";
import Layout from "../components/Layout";
import Warning from "@/components/Warning";
import { IconAlertHexagon, IconChevronDown, IconChevronRight, IconCircleCheck, IconExclamationCircle, IconHelpHexagon, IconRefreshDot } from "@tabler/icons-react";
import PermissionDecisionTree, { type PermissionDebugTrace } from "@/components/PermissionDecisionTree";

type CheckForm = { resource: string; permission: string; subject: string; context: string };
type BulkCheckForm = { resource: string; permission: string; subjects: string };
type ExpandForm = { resource: string; permission: string; context: string };
type LookupForm = { resource: string; permission: string; subjectType: string; context: string };
type LookupSubject = {
    objectType?: string;
    objectId?: string;
    object?: { objectType?: string; objectId?: string };
    optionalRelation?: string;
};

type SingleResult = {
    id: string;
    resource: { type: string; id: string };
    permission: string;
    subject: { type: string; id: string };
    result: "ALLOWED" | "DENIED" | "CONDITIONAL" | "UNKNOWN";
    timestamp: string;
    duration: string;
    debugTrace?: {
        check?: PermissionDebugTrace;
    };
};

type CheckResult =
    | {
        type: "check";
        permissionship: string | number;
        checked_at?: string;
        query: string;
        duration?: number;
        debugTrace?: {
            check?: PermissionDebugTrace;
        };
    }
    | {
        type: "bulk";
        results: SingleResult[];
    }
    | {
        type: "expand";
        tree_root: ExpandNode | null;
        query: string;
    }
    | {
        type: "lookup";
        subjects: LookupSubject[];
        looked_up_at?: string;
        query: string;
    };

type ExpandNode = {
    expandedObject?: { objectType?: string; objectId?: string };
    expandedRelation?: string;
    leaf?: { subjects?: Array<{ object?: { objectType?: string; objectId?: string }; optionalRelation?: string }> };
    children?: ExpandNode[];
};

const CheckPage: NextPage = () => {
    const [checkForm, setCheckForm] = useState<CheckForm>({ resource: "", permission: "", subject: "", context: "" });
    const [bulkCheckForm, setBulkCheckForm] = useState<BulkCheckForm>({ resource: "", permission: "", subjects: "" });
    const [expandForm, setExpandForm] = useState<ExpandForm>({ resource: "", permission: "", context: "" });
    const [lookupForm, setLookupForm] = useState<LookupForm>({
        resource: "",
        permission: "",
        subjectType: "",
        context: "",
    });
    const [activeTab, setActiveTab] = useState<"check" | "bulk" | "expand" | "lookup">("check");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [result, setResult] = useState<CheckResult | null>(null);
    const [isCheckTraceExpanded, setIsCheckTraceExpanded] = useState(false);
    const [expandedTraceIds, setExpandedTraceIds] = useState<Record<string, boolean>>({});
    const [error, setError] = useState<string>("");

    const normalizePermissionship = (permissionship?: string | number) => {
        switch (permissionship) {
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

    const mapPermissionshipToResult = (permissionship?: string | number): "ALLOWED" | "DENIED" | "CONDITIONAL" | "UNKNOWN" => {
        switch (normalizePermissionship(permissionship)) {
            case "HAS_PERMISSION":
                return "ALLOWED";
            case "NO_PERMISSION":
                return "DENIED";
            case "CONDITIONAL_PERMISSION":
                return "CONDITIONAL";
            default:
                return "UNKNOWN";
        }
    };

    const checkPermission = async (resourceValue: string, permission: string, subjectValue: string): Promise<SingleResult> => {
        const [resourceType, resourceId] = resourceValue.split(":");
        const [subjectType, subjectId] = subjectValue.split(":");

        if (!resourceType || !resourceId || !subjectType || !subjectId) {
            throw new Error("Invalid format. Use type:id format");
        }

        const startedAt = performance.now();
        const response = await fetch("/api/spicedb/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                resource: { object_type: resourceType, object_id: resourceId },
                permission,
                subject: { object: { object_type: subjectType, object_id: subjectId } },
                withTracing: true,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Check request failed");
        }

        return {
            id: `${Date.now()}-${subjectType}-${subjectId}`,
            resource: { type: resourceType, id: resourceId },
            permission,
            subject: { type: subjectType, id: subjectId },
            result: mapPermissionshipToResult(data.permissionship),
            timestamp: typeof data.checked_at === "string"
                ? data.checked_at
                : typeof data.checkedAt === "string"
                    ? data.checkedAt
                    : new Date().toISOString(),
            duration: `${Math.max(1, Math.round(performance.now() - startedAt))}ms`,
            debugTrace: data.debugTrace || data.debug_trace,
        };
    };

    const performCheck = async () => {
        if (!checkForm.resource || !checkForm.permission || !checkForm.subject) {
            setError("Resource, permission, and subject are required");
            return;
        }

        setIsLoading(true);
        setError("");
        setResult(null);
        setIsCheckTraceExpanded(false);

        try {
            const [resourceType, resourceId] = checkForm.resource.split(":");
            const [subjectType, subjectId] = checkForm.subject.split(":");
            if (!resourceType || !resourceId || !subjectType || !subjectId) {
                throw new Error("Invalid format. Use type:id format for resource and subject");
            }

            const requestBody: Record<string, any> = {
                resource: { object_type: resourceType, object_id: resourceId },
                permission: checkForm.permission,
                subject: { object: { object_type: subjectType, object_id: subjectId } },
                withTracing: true,
            };

            if (checkForm.context) {
                try {
                    requestBody.context = JSON.parse(checkForm.context);
                } catch {
                    throw new Error("Invalid JSON in context field");
                }
            }

            const response = await fetch("/api/spicedb/check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Check request failed");
            }
            const data = await response.json();
            setResult({
                type: "check",
                permissionship: data.permissionship,
                checked_at: data.checked_at,
                query: `${checkForm.subject} → ${checkForm.resource}#${checkForm.permission}`,
                duration: undefined,
                debugTrace: data.debugTrace || data.debug_trace,
            });
        } catch (err: any) {
            setError(err.message || "Failed to perform permission check");
        } finally {
            setIsLoading(false);
        }
    };

    const performBulkCheck = async () => {
        if (!bulkCheckForm.resource || !bulkCheckForm.permission || !bulkCheckForm.subjects) {
            setError("All fields are required");
            return;
        }

        setIsLoading(true);
        setError("");
        setResult(null);

        try {
            const subjects = bulkCheckForm.subjects.split("\n").map((s) => s.trim()).filter(Boolean);
            const bulkResults = await Promise.all(
                subjects.map((subject) => checkPermission(bulkCheckForm.resource, bulkCheckForm.permission, subject))
            );

            setResult({ type: "bulk", results: bulkResults });
        } catch (err: any) {
            setError(err.message || "Failed to perform bulk permission check");
        } finally {
            setIsLoading(false);
        }
    };

    const performExpand = async () => {
        if (!expandForm.resource || !expandForm.permission) {
            setError("Resource and permission are required");
            return;
        }
        setIsLoading(true);
        setError("");
        setResult(null);

        try {
            const [resourceType, resourceId] = expandForm.resource.split(":");
            if (!resourceType || !resourceId) throw new Error("Invalid format. Use type:id format for resource");

            const requestBody: Record<string, any> = {
                resource: { object_type: resourceType, object_id: resourceId },
                permission: expandForm.permission,
            };
            if (expandForm.context) {
                try {
                    requestBody.context = JSON.parse(expandForm.context);
                } catch {
                    throw new Error("Invalid JSON in context field");
                }
            }

            const response = await fetch("/api/spicedb/expand", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Expand request failed");
            }
            const data = await response.json();
            setResult({ type: "expand", tree_root: data.treeRoot ?? null, query: `${expandForm.resource}#${expandForm.permission}` });
        } catch (err: any) {
            setError(err.message || "Failed to expand permission");
        } finally {
            setIsLoading(false);
        }
    };

    const performLookup = async () => {
        if (!lookupForm.resource || !lookupForm.permission || !lookupForm.subjectType) {
            setError("Resource, permission, and subject type are required");
            return;
        }
        setIsLoading(true);
        setError("");
        setResult(null);

        try {
            const [resourceType, resourceId] = lookupForm.resource.split(":");
            if (!resourceType || !resourceId) throw new Error("Invalid format. Use type:id format for resource");

            const requestBody: Record<string, any> = {
                resource: { objectType: resourceType, objectId: resourceId },
                permission: lookupForm.permission,
                subjectObjectType: lookupForm.subjectType,
            };
            if (lookupForm.context) {
                try {
                    requestBody.context = JSON.parse(lookupForm.context);
                } catch {
                    throw new Error("Invalid JSON in context field");
                }
            }

            const response = await fetch("/api/spicedb/lookup-subjects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Lookup request failed");
            }
            const data = await response.json();
            setResult({
                type: "lookup",
                subjects: Array.isArray(data.subjects) ? data.subjects : [],
                looked_up_at: data.looked_up_at,
                query: `${lookupForm.resource}#${lookupForm.permission} ← ${lookupForm.subjectType}:*`,
            });
        } catch (err: any) {
            setError(err.message || "Failed to lookup subjects");
        } finally {
            setIsLoading(false);
        }
    };

    const renderExpandTree = (node: ExpandNode | null, depth = 0): JSX.Element | null => {
        if (!node) return null;
        const indent = depth * 20;
        return (
            <div
                key={`${node.expandedObject?.objectType}-${node.expandedObject?.objectId}-${depth}`}
                style={{ marginLeft: `${indent}px` }}
                className="py-1"
            >
                <div className="flex items-center space-x-2 mb-2">
                    <span className="text-blue-600">🏢</span>
                    <span className="font-mono text-sm font-semibold">
                        {node.expandedObject?.objectType}:{node.expandedObject?.objectId}
                        {node.expandedRelation && `#${node.expandedRelation}`}
                    </span>
                </div>

                {node.leaf?.subjects?.map((subject, index) => (
                    <div key={`subject-${index}-${subject.object?.objectId}`} style={{ marginLeft: `${indent + 20}px` }} className="py-1">
                        <div className="flex items-center space-x-2">
                            <span className="text-green-600">👤</span>
                            <span className="font-mono text-sm">
                                {subject.object?.objectType}:{subject.object?.objectId}
                                {subject.optionalRelation && `#${subject.optionalRelation}`}
                            </span>
                        </div>
                    </div>
                ))}

                {node.children?.map((child, i) => (
                    <div key={`child-${i}`}>{renderExpandTree(child, depth + 1)}</div>
                ))}
            </div>
        );
    };

    const getLookupSubjectLabel = (subject: LookupSubject) => {
        const objectType = subject.object?.objectType || subject.objectType;
        const objectId = subject.object?.objectId || subject.objectId;
        const optionalRelation = subject.optionalRelation ? `#${subject.optionalRelation}` : "";

        if (!objectType && !objectId) {
            return "Unknown subject";
        }

        return `${objectType ?? "?"}:${objectId ?? "?"}${optionalRelation}`;
    };

    const toggleTrace = (id: string) => {
        setExpandedTraceIds((current) => ({
            ...current,
            [id]: !current[id],
        }));
    };

    const hasTrace = (item: SingleResult) => Boolean(item.debugTrace?.check);

    const isTraceExpanded = (id: string) => Boolean(expandedTraceIds[id]);

    const getResultColor = (r: SingleResult["result"]) => {
        switch (r) {
            case "ALLOWED":
                return "bg-green-100 text-green-800";
            case "DENIED":
                return "bg-red-100 text-red-800";
            case "CONDITIONAL":
                return "bg-yellow-100 text-yellow-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    const getResultIcon = (r: SingleResult["result"]) => {
        switch (r) {
            case "ALLOWED":
                return <IconCircleCheck />;
            case "DENIED":
                return <IconExclamationCircle />;
            case "CONDITIONAL":
                return <IconAlertHexagon />;
            default:
                return <IconHelpHexagon />;
        }
    };

    const getPermissionshipColor = (p?: string | number) => {
        switch (normalizePermissionship(p)) {
            case "HAS_PERMISSION":
                return "bg-green-100 text-green-800 border-green-200";
            case "NO_PERMISSION":
                return "bg-red-100 text-red-800 border-red-200";
            case "CONDITIONAL_PERMISSION":
                return "bg-yellow-100 text-yellow-800 border-yellow-200";
            default:
                return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    const getPermissionshipIcon = (p?: string | number) => {
        switch (normalizePermissionship(p)) {
            case "HAS_PERMISSION":
                return <IconCircleCheck />;
            case "NO_PERMISSION":
                return <IconExclamationCircle />;
            case "CONDITIONAL_PERMISSION":
                return <IconAlertHexagon />;
            default:
                return <IconHelpHexagon />;
        }
    };

    const getPermissionshipText = (p?: string | number) => {
        switch (normalizePermissionship(p)) {
            case "HAS_PERMISSION":
                return "Permission Allowed";
            case "NO_PERMISSION":
                return "Permission Denied";
            case "CONDITIONAL_PERMISSION":
                return "Conditional Permission";
            default:
                return "Unknown";
        }
    };

    const renderPermissionQuery = (query: string, permissionship: string | number) => {
        // Parse query: "user:ceo → resource:promserver#view"
        const parts = query.split(' → ');
        if (parts.length !== 2) return <span className="font-mono text-sm">{query}</span>;

        const subject = parts[0]; // "user:ceo"
        const resourceAndPermission = parts[1]; // "resource:promserver#view"

        const resourceMatch = resourceAndPermission.match(/^(.+?):(.+?)#(.+)$/);
        if (!resourceMatch) return <span className="font-mono text-sm">{query}</span>;

        const resourceType = resourceMatch[1]; // "resource"
        const resourceId = resourceMatch[2]; // "promserver"
        const permission = resourceMatch[3]; // "view"

        const normalizedPermissionship = normalizePermissionship(permissionship);
        const isAllowed = normalizedPermissionship === "HAS_PERMISSION";
        const permissionPillColor = isAllowed
            ? "bg-green-100 text-green-800 border-green-200"
            : "bg-red-100 text-red-800 border-red-200";

        return (
            <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border-blue-200">
                    {subject}
                </span>
                <span className="text-gray-400">→</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border-purple-200">
                    {resourceType}
                </span>
                <span className="text-gray-400">→</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${permissionPillColor}`}>
                    {resourceId}#{permission}
                </span>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="inline-flex items-center gap-2 text-2xl font-bold text-gray-900">
                    <IconCircleCheck className="text-orange-300" size={30} aria-hidden />
                    Authorization Check
                </h2>
                <p className="text-gray-400">Perform permission checks, expand permissions, and lookup subjects.</p>
            </div>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {(["check", "bulk", "expand", "lookup"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            {tab === "check" ? "Permission Check" : tab === "bulk" ? "Bulk Check" : tab === "expand" ? "Expand Permission" : "Lookup Subjects"}
                        </button>
                    ))}
                </nav>
            </div>

            {error && (
                <Warning
                    title="Check Error"
                    error={error}
                />
            )}

            {activeTab === "check" && (
                <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Permission Check</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Resource (type:id)</label>
                                <input
                                    type="text"
                                    placeholder="e.g., document:readme"
                                    value={checkForm.resource}
                                    onChange={(e) => setCheckForm({ ...checkForm, resource: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Permission</label>
                                <input
                                    type="text"
                                    placeholder="e.g., view, edit, delete"
                                    value={checkForm.permission}
                                    onChange={(e) => setCheckForm({ ...checkForm, permission: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subject (type:id)</label>
                                <input
                                    type="text"
                                    placeholder="e.g., user:alice"
                                    value={checkForm.subject}
                                    onChange={(e) => setCheckForm({ ...checkForm, subject: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Context (JSON, optional)</label>
                                <input
                                    type="text"
                                    placeholder='e.g., {"ip": "192.168.1.1"}'
                                    value={checkForm.context}
                                    onChange={(e) => setCheckForm({ ...checkForm, context: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <button
                                onClick={performCheck}
                                disabled={isLoading}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="animate-spin mr-2"><IconRefreshDot /></div>
                                        Checking...
                                    </>
                                ) : (
                                    <>
                                        <span className="mr-2"><IconCircleCheck /></span>
                                        Check Permission
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "bulk" && (
                <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Bulk Permission Check</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Resource</label>
                                <input
                                    type="text"
                                    placeholder="e.g., document:readme"
                                    value={bulkCheckForm.resource}
                                    onChange={(e) => setBulkCheckForm({ ...bulkCheckForm, resource: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Permission</label>
                                <input
                                    type="text"
                                    placeholder="e.g., view, edit, delete"
                                    value={bulkCheckForm.permission}
                                    onChange={(e) => setBulkCheckForm({ ...bulkCheckForm, permission: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Subjects (one per line)</label>
                            <textarea
                                rows={6}
                                placeholder={`user:alice\nuser:bob\nuser:charlie\norganization:acme`}
                                value={bulkCheckForm.subjects}
                                onChange={(e) => setBulkCheckForm({ ...bulkCheckForm, subjects: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div className="mt-4">
                            <button
                                onClick={performBulkCheck}
                                disabled={isLoading}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="animate-spin mr-2"><IconRefreshDot /></div>
                                        Checking...
                                    </>
                                ) : (
                                    <>
                                        <span className="mr-2"><IconCircleCheck /></span>
                                        Bulk Check
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "expand" && (
                <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Expand Permission</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Resource (type:id)</label>
                                <input
                                    type="text"
                                    placeholder="e.g., document:readme"
                                    value={expandForm.resource}
                                    onChange={(e) => setExpandForm({ ...expandForm, resource: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Permission</label>
                                <input
                                    type="text"
                                    placeholder="e.g., view, edit, delete"
                                    value={expandForm.permission}
                                    onChange={(e) => setExpandForm({ ...expandForm, permission: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Context (JSON, optional)</label>
                                <input
                                    type="text"
                                    placeholder='e.g., {"ip": "192.168.1.1"}'
                                    value={expandForm.context}
                                    onChange={(e) => setExpandForm({ ...expandForm, context: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <button
                                onClick={performExpand}
                                disabled={isLoading}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="animate-spin mr-2"><IconRefreshDot /></div>
                                        Expanding...
                                    </>
                                ) : (
                                    <>
                                        <span className="mr-2"><IconCircleCheck /></span>
                                        Expand Permission
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Expand tree result */}
                        {result && result.type === "expand" && (
                            <div className="mt-6 border rounded-lg p-4">{renderExpandTree(result.tree_root ?? null)}</div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === "lookup" && (
                <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Lookup Subjects</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Resource (type:id)</label>
                                <input
                                    type="text"
                                    placeholder="e.g., document:readme"
                                    value={lookupForm.resource}
                                    onChange={(e) => setLookupForm({ ...lookupForm, resource: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Permission</label>
                                <input
                                    type="text"
                                    placeholder="e.g., view, edit, delete"
                                    value={lookupForm.permission}
                                    onChange={(e) => setLookupForm({ ...lookupForm, permission: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Type</label>
                                <input
                                    type="text"
                                    placeholder="e.g., user, organization"
                                    value={lookupForm.subjectType}
                                    onChange={(e) => setLookupForm({ ...lookupForm, subjectType: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Context (JSON, optional)</label>
                                <input
                                    type="text"
                                    placeholder='e.g., {"ip": "192.168.1.1"}'
                                    value={lookupForm.context}
                                    onChange={(e) => setLookupForm({ ...lookupForm, context: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <div className="mt-4">
                                <button
                                    onClick={performLookup}
                                    disabled={isLoading}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="animate-spin mr-2"><IconRefreshDot /></div>
                                            Looking up...
                                        </>
                                    ) : (
                                        <>
                                            <span className="mr-2"><IconCircleCheck /></span>
                                            Lookup Subjects
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {result && result.type === "lookup" && (
                            <div className="mt-6 space-y-2">
                                {(result.subjects ?? []).map((s, i) => (
                                    <div key={`${s.object?.objectType || s.objectType}-${s.object?.objectId || s.objectId}-${i}`} className="p-2 border rounded">
                                        <span className="font-mono text-sm">
                                            {getLookupSubjectLabel(s)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {result && result.type === "bulk" && (
                <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Latest Result</h3>
                        <p className="text-sm text-gray-600 mb-3">
                            Checked {result.results.length} subjects for permission{" "}
                            <strong>{result.results[0]?.permission}</strong> on{" "}
                            <strong>
                                {result.results[0]?.resource.type}:{result.results[0]?.resource.id}
                            </strong>
                        </p>
                        <div className="space-y-2">
                            {result.results.map((r) => (
                                <div key={r.id} className="rounded-lg border p-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                            {hasTrace(r) && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleTrace(r.id)}
                                                    className="inline-flex items-center gap-1 pt-0.5 text-sm font-medium text-blue-600 hover:text-blue-800"
                                                    aria-expanded={isTraceExpanded(r.id)}
                                                >
                                                    {isTraceExpanded(r.id) ? (
                                                        <IconChevronDown className="h-4 w-4" aria-hidden />
                                                    ) : (
                                                        <IconChevronRight className="h-4 w-4" aria-hidden />
                                                    )}
                                                    Explain
                                                </button>
                                            )}
                                            <span className="text-sm font-medium">
                                                {r.subject.type}:{r.subject.id}
                                            </span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${getResultColor(r.result)}`}>
                                                {getResultIcon(r.result)} {r.result}
                                            </span>
                                            <span className="text-xs text-gray-500">{r.duration}</span>
                                        </div>
                                    </div>
                                    {isTraceExpanded(r.id) && r.debugTrace?.check && (
                                        <PermissionDecisionTree trace={r.debugTrace.check} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {result && result.type === "check" && (
                <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Latest Result</h3>
                        <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium mr-2 ${getPermissionshipColor(result.permissionship)}`}>
                            <span className="mr-2">{getPermissionshipIcon(result.permissionship)}</span>
                            <span className="font-semibold">{getPermissionshipText(result.permissionship)}</span>
                        </div>
                        <div className="mt-4">
                            {renderPermissionQuery(result.query, result.permissionship)}
                        </div>
                        {result.debugTrace?.check && (
                            <div className="mt-4 space-y-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCheckTraceExpanded((prev) => !prev)}
                                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
                                    aria-expanded={isCheckTraceExpanded}
                                >
                                    {isCheckTraceExpanded ? (
                                        <IconChevronDown className="h-4 w-4" aria-hidden />
                                    ) : (
                                        <IconChevronRight className="h-4 w-4" aria-hidden />
                                    )}
                                    Explain
                                </button>
                                {isCheckTraceExpanded && <PermissionDecisionTree trace={result.debugTrace.check} />}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CheckPage;
