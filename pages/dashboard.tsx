import type { NextPage } from "next";
import { JSX, useEffect, useRef, useState } from "react";
import {
    IconBuilding,
    IconCode,
    IconLink,
    IconCircleCheck,
    IconSettings,
    IconAlertTriangle,
    IconNotes,
    IconLayoutDashboard,
    IconUsers,
    IconX,
    IconHash,
    IconClock,
    IconList,
    IconHistory,
} from "@tabler/icons-react";
import Warning from "@/components/Warning";

type Stats = {
    totalNamespaces: number;
    totalRelationships: number;
    totalSubjects: number;
    lastUpdate: string | null;
    isConnected: boolean;
    schemaHash?: string;
    apiResponseTime?: number;
    namespacesWithRelationCounts?: {
        namespace: string;
        relationshipCount: number;
        subjectCount: number;
        relationTypes: string[];
    }[];
};

type Activity = {
    id: string;
    type: "schema" | "relationship" | "check" | "system" | "error" | string;
    title?: string;
    action?: string;
    resource?: string;
    timestamp?: string;
    description?: string;
    createdAt?: string;
};

const Dashboard: NextPage = () => {
    const [stats, setStats] = useState<Stats>({
        totalNamespaces: 0,
        totalRelationships: 0,
        totalSubjects: 0,
        lastUpdate: null,
        isConnected: false,
    });

    const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
    const [healthHistory, setHealthHistory] = useState<any[]>(() => {
        // Initialize from localStorage if available
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('healthHistory');
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {
                    console.error('Failed to parse saved health history:', e);
                }
            }
        }
        return [];
    });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");

    // Only show "Connection Problem" after we've actually checked health at least once
    const [healthChecked, setHealthChecked] = useState<boolean>(false);

    // Ignore stale async responses
    const requestIdRef = useRef(0);

    const refreshData = async (signal?: AbortSignal, isInitialLoad = false) => {
        const rid = ++requestIdRef.current;
        // Never show loading spinner
        setError("");

        try {
            const [statsRes, healthRes, activityRes, healthHistoryRes] = await Promise.all([
                fetch("/api/spicedb/stats", { signal }),
                fetch("/api/spicedb/health", { signal }),
                fetch("/api/spicedb/activity", { signal }),
                fetch("/api/spicedb/health-history", { signal }),
            ]);

            if (rid !== requestIdRef.current) return; // a newer request finished already

            // Stats
            if (!statsRes.ok) throw new Error("Failed to load stats");
            const statsData = await statsRes.json();

            // Health is source of truth for connection
            let connected = stats.isConnected;
            if (healthRes.ok) {
                const healthData = await healthRes.json();
                connected = !!healthData.connected;
                setHealthChecked(true);
            } else {
                // Health check failed - we're disconnected
                connected = false;
                setHealthChecked(true);
            }

            // Activity (best-effort)
            if (activityRes.ok) {
                const activityData = await activityRes.json();
                if (activityData.activities && Array.isArray(activityData.activities)) {
                    setRecentActivity(activityData.activities);
                }
            }

            // Health History (best-effort) - Don't clear on failure, keep showing last known state
            if (healthHistoryRes.ok) {
                try {
                    const historyData = await healthHistoryRes.json();
                    if (historyData.history && Array.isArray(historyData.history)) {
                        setHealthHistory(historyData.history);
                        // Save to localStorage for persistence
                        if (typeof window !== 'undefined') {
                            localStorage.setItem('healthHistory', JSON.stringify(historyData.history));
                        }
                    }
                } catch (e) {
                    // Keep existing health history on parse error
                    console.error('Failed to parse health history:', e);
                }
            }
            // Note: We intentionally don't clear healthHistory on failure - we want to keep showing it

            setStats({
                totalNamespaces: statsData.totalNamespaces ?? 0,
                totalRelationships: statsData.totalRelationships ?? 0,
                totalSubjects: statsData.totalSubjects ?? 0,
                lastUpdate: statsData.lastUpdate ? new Date(statsData.lastUpdate).toLocaleString() : null,
                isConnected: connected,
                schemaHash: statsData.schemaHash,
                apiResponseTime: statsData.apiResponseTime,
                namespacesWithRelationCounts: statsData.namespacesWithRelationCounts ?? [],
            });
        } catch (e: any) {
            if (signal?.aborted) return;
            // Don't show errors, just let the disconnected status show
        } finally {
            // Never use loading state
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        refreshData(controller.signal, true); // Initial load

        // Poll every 30s (silent)
        const interval = setInterval(() => {
            const c = new AbortController();
            refreshData(c.signal, false); // Background refresh
        }, 30000);

        // Revalidate on focus / when tab becomes visible (silent)
        const onFocus = () => refreshData(undefined, false);
        const onVisible = () => {
            if (!document.hidden) refreshData(undefined, false);
        };
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisible);

        return () => {
            controller.abort();
            clearInterval(interval);
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, []);

    const showConnectionProblem = healthChecked && !isLoading && !stats.isConnected;

    const getActivityIcon = (activity: Activity): JSX.Element => {
        // Special handling for connection events
        if (activity.id?.startsWith('conn-')) {
            if (activity.title === "Connection Restored") {
                return <IconCircleCheck size={16} stroke={1.8} className="text-green-400" />;
            } else if (activity.title === "Connection Lost") {
                return <IconX size={16} stroke={1.8} className="text-red-400" />;
            }
        }
        
        switch (activity.type) {
            case "schema":
                return <IconCode size={16} stroke={1.8} />;
            case "relationship":
                return <IconLink size={16} stroke={1.8} />;
            case "check":
                return <IconCircleCheck size={16} stroke={1.8} />;
            case "system":
                return <IconSettings size={16} stroke={1.8} />;
            case "error":
                return <IconAlertTriangle size={16} stroke={1.8} />;
            default:
                return <IconNotes size={16} stroke={1.8} />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="inline-flex items-center gap-2 text-2xl font-bold text-white">
                        <IconLayoutDashboard className="text-orange-300" size={30} aria-hidden />
                        Dashboard
                    </h2>
                    <p className="text-gray-400">
                        Overview of your database.
                    </p>
                </div>
            </div>
            {error && (
                <Warning
                    title="General Error"
                    error={error}
                />
            )}

            {/* Main Stats */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                {stats.isConnected ? (
                                    <IconCircleCheck size={24} stroke={1.8} className="text-green-400" aria-hidden />
                                ) : (
                                    <IconX size={24} stroke={1.8} className="text-red-400" aria-hidden />
                                )}
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-zinc-400 truncate">Status</dt>
                                    <dd
                                        className={`text-lg font-medium ${stats.isConnected ? "text-green-400" : "text-red-400"
                                            }`}
                                    >
                                        {stats.isConnected ? "Connected" : "Disconnected"}
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <IconBuilding size={24} stroke={1.8} className="text-purple-500" aria-hidden />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-zinc-400 truncate">Namespaces</dt>
                                    <dd className="text-xl flex mt-1 p-1 bg-blue-900 rounded-lg w-40 justify-center items-center font-bold text-white font-mono">{stats.isConnected ? stats.totalNamespaces : '--'}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <IconLink size={24} stroke={1.8} className="text-purple-500" aria-hidden />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-zinc-400 truncate">Relationships</dt>
                                    <dd className="text-xl flex mt-1 p-1 bg-blue-900 rounded-lg w-40 justify-center items-center font-bold text-white font-mono">{stats.isConnected ? stats.totalRelationships : '--'}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <IconUsers size={24} stroke={1.8} className="text-purple-500" aria-hidden />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-zinc-400 truncate">Subjects</dt>
                                    <dd className="text-xl flex mt-1 p-1 bg-blue-900 rounded-lg w-40 justify-center items-center font-bold text-white font-mono">{stats.isConnected ? stats.totalSubjects : '--'}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <IconHash size={24} stroke={1.8} className="text-purple-500" aria-hidden />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-zinc-400 truncate">Schema Hash</dt>
                                    <dd className="text-xl flex mt-1 p-1 bg-blue-900 rounded-lg w-40 justify-center items-center font-bold text-white font-mono">
                                        {stats.isConnected ? (stats.schemaHash ? stats.schemaHash.slice(0, 8) : 'N/A') : '--'}
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <IconClock size={24} stroke={1.8} className="text-purple-500" aria-hidden />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-zinc-400 truncate">Average API Response</dt>
                                    <dd className="text-xl flex mt-1 p-1 bg-blue-900 rounded-lg w-40 justify-center items-center font-bold text-white font-mono">
                                        {stats.isConnected ? (stats.apiResponseTime ? `${stats.apiResponseTime}ms` : 'N/A') : '--'}
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

 {/* Recent Activity and Health History Side by Side */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Recent Activity */}
                <div className="bg-gray-800 shadow rounded-lg border border-gray-700">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-white mb-4 flex items-center gap-2">
                            <IconHistory size={20} className="text-gray-400" />
                            Recent Activity
                        </h3>
                        {recentActivity.length > 0 ? (
                            <div className="flow-root">
                                <ul className="-mb-8">
                                    {recentActivity.map((activity, idx) => (
                                        <li key={activity.id}>
                                            <div className="relative pb-8">
                                                {idx !== recentActivity.length - 1 ? (
                                                    <span
                                                        className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-600"
                                                        aria-hidden="true"
                                                    />
                                                ) : null}
                                                <div className="relative flex space-x-3">
                                                    <div>
                                                        <span className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center">
                                                            {getActivityIcon(activity)}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm text-white">
                                                            {activity.title ?? activity.action ?? activity.type}
                                                        </p>
                                                        {(activity.description || activity.resource) && (
                                                            <p className="text-sm text-gray-400">{activity.description ?? activity.resource}</p>
                                                        )}
                                                        {(activity.createdAt || activity.timestamp) && (
                                                            <p className="text-xs text-gray-400 mt-1">
                                                                {activity.createdAt ? new Date(activity.createdAt).toLocaleString() : activity.timestamp}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <p className="text-gray-400">No recent activity</p>
                        )}
                    </div>
                </div>

                {/* Connection Health History */}
                <div className="bg-gray-800 shadow rounded-lg border border-gray-700">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-white mb-4 flex items-center gap-2">
                            <IconCircleCheck size={20} className="text-gray-400" />
                            Connection Health History
                        </h3>
                        {healthHistory && healthHistory.length > 0 ? (
                            <div className="space-y-2">
                                {healthHistory.map((entry) => (
                                    <div key={entry.id} className="flex items-center justify-between py-2 px-3 rounded border border-gray-600 bg-gray-750">
                                        <div className="flex items-center space-x-3">
                                            {entry.connected ? (
                                                <IconCircleCheck size={16} className="text-green-400" />
                                            ) : (
                                                <IconX size={16} className="text-red-400" />
                                            )}
                                            <div>
                                                <span className={`text-sm font-medium ${
                                                    entry.connected ? 'text-green-300' : 'text-red-300'
                                                }`}>
                                                    {entry.title || (entry.type === 'initial' ? 'Initial Connection' :
                                                     entry.type === 'reconnected' ? 'Reconnected' :
                                                     entry.type === 'disconnected' ? 'Connection Lost' :
                                                     (entry.connected ? 'Connected' : 'Disconnected'))}
                                                </span>
                                                {entry.description && (
                                                    <p className="text-xs text-gray-400 mt-1">{entry.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-sm text-gray-400 flex items-center space-x-2">
                                            {entry.responseTime && (
                                                <span>{entry.responseTime}ms</span>
                                            )}
                                            <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-400">No connection history yet</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Namespace Details */}
            {stats.namespacesWithRelationCounts && stats.namespacesWithRelationCounts.length > 0 && (
                <div className="bg-gray-800 shadow rounded-lg border border-gray-700">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-white mb-4 flex items-center gap-2">
                            <IconList size={20} className="text-gray-400" />
                            Namespace Details
                        </h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
                            {stats.namespacesWithRelationCounts.map((ns) => (
                                <div key={ns.namespace} className="border border-gray-600 rounded-lg bg-gray-750 p-4">
                                    <h4 className="font-medium text-white mb-2">{ns.namespace}</h4>
                                    <div className="space-y-1 text-sm text-gray-400">
                                        <div>Relationships: <span className="font-medium text-white">{ns.relationshipCount}</span></div>
                                        <div>Subjects: <span className="font-medium text-white">{ns.subjectCount}</span></div>
                                        <div>Relations: <span className="font-medium text-white">{ns.relationTypes.join(', ')}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

           
        </div>
    );
};

export default Dashboard;