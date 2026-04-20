import type { NextPage } from "next";
import { useState } from "react";
import Layout from "../components/Layout";
import {
    IconAlertHexagon,
    IconCircleCheck,
    IconChevronDown,
    IconChevronRight,
    IconExclamationCircle,
    IconHelpHexagon,
    IconRefreshDot,
    IconShieldCheck,
} from "@tabler/icons-react";
import Warning from "@/components/Warning";
import PermissionDecisionTree, { type PermissionDebugTrace } from "@/components/PermissionDecisionTree";

type SingleCheckForm = { resource: string; permission: string; subject: string };
type BulkCheckForm = { resource: string; permission: string; subjects: string };
type PermissionResult = "ALLOWED" | "DENIED" | "CONDITIONAL" | "UNKNOWN";

type PermissionDebugInfo = {
    check?: PermissionDebugTrace;
};

type SingleResult = {
    id: string;
    resource: { type: string; id: string };
    permission: string;
    subject: { type: string; id: string };
    result: PermissionResult;
    timestamp: string;
    duration: string;
    debugTrace?: PermissionDebugInfo;
};

type BulkResult = { type: "bulk"; results: SingleResult[] };

const Permissions: NextPage = () => {
    const [checkHistory, setCheckHistory] = useState<SingleResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [checkForm, setCheckForm] = useState<SingleCheckForm>({ resource: "", permission: "", subject: "" });
    const [bulkCheck, setBulkCheck] = useState<BulkCheckForm>({ resource: "", permission: "", subjects: "" });
    const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");
    const [error, setError] = useState<string>("");
    const [result, setResult] = useState<SingleResult | BulkResult | null>(null);
    const [expandedTraceIds, setExpandedTraceIds] = useState<Record<string, boolean>>({});

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

    const mapPermissionshipToResult = (permissionship?: string | number): PermissionResult => {
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

    const buildCheckRequest = (resourceValue: string, permission: string, subjectValue: string) => {
        const [resourceType, resourceId] = resourceValue.split(":");
        const [subjectType, subjectId] = subjectValue.split(":");

        if (!resourceType || !resourceId || !subjectType || !subjectId) {
            throw new Error("Invalid format. Use type:id format");
        }

        return {
            resource: { object_type: resourceType, object_id: resourceId },
            permission,
            subject: { object: { object_type: subjectType, object_id: subjectId } },
            resourceType,
            resourceId,
            subjectType,
            subjectId,
        };
    };

    const buildSingleResult = ({
        permission,
        resourceType,
        resourceId,
        subjectType,
        subjectId,
        data,
        duration,
    }: {
        permission: string;
        resourceType: string;
        resourceId: string;
        subjectType: string;
        subjectId: string;
        data: Record<string, any>;
        duration: string;
    }): SingleResult => ({
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
        duration,
        debugTrace: data.debugTrace || data.debug_trace,
    });

    const toggleTrace = (id: string) => {
        setExpandedTraceIds((current) => ({
            ...current,
            [id]: !current[id],
        }));
    };

    const hasTrace = (item: SingleResult) => Boolean(item.debugTrace?.check);

    const isTraceExpanded = (id: string) => Boolean(expandedTraceIds[id]);

    const checkPermission = async (resourceValue: string, permission: string, subjectValue: string) => {
        const request = buildCheckRequest(resourceValue, permission, subjectValue);
        const startedAt = performance.now();
        const response = await fetch("/api/spicedb/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                resource: request.resource,
                permission: request.permission,
                subject: request.subject,
                withTracing: true,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Check request failed");
        }

        return buildSingleResult({
            permission,
            resourceType: request.resourceType,
            resourceId: request.resourceId,
            subjectType: request.subjectType,
            subjectId: request.subjectId,
            data,
            duration: `${Math.max(1, Math.round(performance.now() - startedAt))}ms`,
        });
    };

    const performSingleCheck = async () => {
        if (!checkForm.resource || !checkForm.permission || !checkForm.subject) {
            setError("All fields are required");
            return;
        }

        setIsLoading(true);
        setError("");
        setResult(null);

        try {
            const singleResult = await checkPermission(checkForm.resource, checkForm.permission, checkForm.subject);
            setResult(singleResult);
            setCheckHistory((prev) => [singleResult, ...prev]);
        } catch (err: any) {
            setError(err.message || "Failed to perform permission check");
        } finally {
            setIsLoading(false);
        }
    };

    const performBulkCheck = async () => {
        if (!bulkCheck.resource || !bulkCheck.permission || !bulkCheck.subjects) {
            setError("All fields are required");
            return;
        }

        setIsLoading(true);
        setError("");
        setResult(null);

        try {
            const subjects = bulkCheck.subjects.split("\n").map((s) => s.trim()).filter(Boolean);
            const bulkResults = await Promise.all(
                subjects.map((subject) => checkPermission(bulkCheck.resource, bulkCheck.permission, subject))
            );

            setResult({ type: "bulk", results: bulkResults });
            setCheckHistory((prev) => [...bulkResults, ...prev]);
        } catch (err: any) {
            setError(err.message || "Failed to perform bulk permission check");
        } finally {
            setIsLoading(false);
        }
    };

    const clearHistory = () => {
        setCheckHistory([]);
        setResult(null);
    };

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

    return (
        <div className="space-y-6">
            <div>
                <h2 className="inline-flex items-center gap-2 text-2xl font-bold text-gray-900">
                    <IconShieldCheck className="text-orange-300" size={30} aria-hidden />
                    Permission Checks</h2>
                <p className="text-gray-400">Test authorization queries against your instance.</p>
            </div>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab("single")}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "single"
                            ? "border-blue-500 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                    >
                        Single Check
                    </button>
                    <button
                        onClick={() => setActiveTab("bulk")}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "bulk"
                            ? "border-blue-500 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                    >
                        Bulk Check
                    </button>
                </nav>
            </div>

            {error && (
                <Warning
                    title="Permissions Error"
                    error={error}
                />
            )}

            {activeTab === "single" && (
                <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Single Permission Check</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Resource</label>
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                                <input
                                    type="text"
                                    placeholder="e.g., user:alice"
                                    value={checkForm.subject}
                                    onChange={(e) => setCheckForm({ ...checkForm, subject: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <button
                                onClick={performSingleCheck}
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
                                    value={bulkCheck.resource}
                                    onChange={(e) => setBulkCheck({ ...bulkCheck, resource: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Permission</label>
                                <input
                                    type="text"
                                    placeholder="e.g., view, edit, delete"
                                    value={bulkCheck.permission}
                                    onChange={(e) => setBulkCheck({ ...bulkCheck, permission: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Subjects (one per line)</label>
                            <textarea
                                rows={6}
                                placeholder={`user:alice\nuser:bob\nuser:charlie\norganization:acme`}
                                value={bulkCheck.subjects}
                                onChange={(e) => setBulkCheck({ ...bulkCheck, subjects: e.target.value })}
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

            {result && (
                <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Latest Result</h3>

                        {"type" in result ? (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-600 mb-3">
                                    Checked {result.results.length} subjects for permission{" "}
                                    <strong>{result.results[0]?.permission}</strong> on{" "}
                                    <strong>
                                        {result.results[0]?.resource.type}:{result.results[0]?.resource.id}
                                    </strong>
                                </p>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                        ) : (
                            <div className="space-y-3 rounded-lg border p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        {hasTrace(result) && (
                                            <button
                                                type="button"
                                                onClick={() => toggleTrace(result.id)}
                                                className="inline-flex items-center gap-1 pt-0.5 text-sm font-medium text-blue-600 hover:text-blue-800"
                                                aria-expanded={isTraceExpanded(result.id)}
                                            >
                                                {isTraceExpanded(result.id) ? (
                                                    <IconChevronDown className="h-4 w-4" aria-hidden />
                                                ) : (
                                                    <IconChevronRight className="h-4 w-4" aria-hidden />
                                                )}
                                                Explain
                                            </button>
                                        )}
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {result.subject.type}:{result.subject.id} → {result.resource.type}:{result.resource.id}#
                                                {result.permission}
                                            </p>
                                            <p className="text-xs text-gray-500">Duration: {result.duration}</p>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded text-sm font-medium ${getResultColor(result.result)}`}>
                                        {getResultIcon(result.result)} {result.result}
                                    </span>
                                </div>
                                {isTraceExpanded(result.id) && result.debugTrace?.check && (
                                    <PermissionDecisionTree trace={result.debugTrace.check} />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Check History ({checkHistory.length})</h3>
                        {checkHistory.length > 0 && (
                            <button
                                onClick={clearHistory}
                                className="px-3 py-1 text-sm rounded border border-gray-300 hover:bg-gray-50"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    {checkHistory.length ? (
                        <div className="space-y-2">
                            {checkHistory.map((h) => (
                                <div key={h.id} className="rounded-lg border p-3">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            {hasTrace(h) && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleTrace(h.id)}
                                                    className="inline-flex items-center gap-1 pt-0.5 text-sm font-medium text-blue-600 hover:text-blue-800"
                                                    aria-expanded={isTraceExpanded(h.id)}
                                                >
                                                    {isTraceExpanded(h.id) ? (
                                                        <IconChevronDown className="h-4 w-4" aria-hidden />
                                                    ) : (
                                                        <IconChevronRight className="h-4 w-4" aria-hidden />
                                                    )}
                                                    Explain
                                                </button>
                                            )}
                                            <div>
                                                <p className="text-sm">
                                                    {h.subject.type}:{h.subject.id} → {h.resource.type}:{h.resource.id}#{h.permission}
                                                </p>
                                                <p className="text-xs text-gray-500">{new Date(h.timestamp).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getResultColor(h.result)}`}>
                                            {getResultIcon(h.result)} {h.result}
                                        </span>
                                    </div>
                                    {isTraceExpanded(h.id) && h.debugTrace?.check && (
                                        <PermissionDecisionTree trace={h.debugTrace.check} />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No checks yet</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Permissions;
