import type { NextPage } from "next";
import { JSX, useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import {
    IconAlertHexagon,
    IconBuilding,
    IconCode,
    IconLink,
    IconCircleCheck,
    IconRefresh,
    IconSettings,
    IconAlertTriangle,
    IconNotes,
    IconLayoutDashboard,
    IconRefreshDot,
} from "@tabler/icons-react";
import Warning from "@/components/Warning";

type Stats = {
    totalNamespaces: number;
    totalRelationships: number;
    totalSubjects: number;
    lastUpdate: string | null;
    isConnected: boolean;
};

type Activity = {
    id: string;
    type: "schema" | "relationship" | "check" | "system" | "error" | string;
    title?: string;
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
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");

    // Only show "Connection Problem" after we've actually checked health at least once
    const [healthChecked, setHealthChecked] = useState<boolean>(false);

    // Ignore stale async responses
    const requestIdRef = useRef(0);

    const refreshData = async (signal?: AbortSignal) => {
        const rid = ++requestIdRef.current;
        setIsLoading(true);
        setError("");

        try {
            const [statsRes, healthRes, activityRes] = await Promise.all([
                fetch("/api/spicedb/stats", { signal }),
                fetch("/api/spicedb/health", { signal }),
                fetch("/api/spicedb/activity", { signal }),
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
            }

            // Activity (best-effort)
            if (activityRes.ok) {
                const activityData = await activityRes.json();
                setRecentActivity(Array.isArray(activityData.activities) ? activityData.activities : []);
            }

            setStats({
                totalNamespaces: statsData.totalNamespaces ?? 0,
                totalRelationships: statsData.totalRelationships ?? 0,
                totalSubjects: statsData.totalSubjects ?? 0,
                lastUpdate: statsData.lastUpdate ? new Date(statsData.lastUpdate).toLocaleString() : null,
                isConnected: connected,
            });
        } catch (e: any) {
            if (signal?.aborted) return;
            setError(e?.message || "Connection error");
        } finally {
            if (rid === requestIdRef.current) setIsLoading(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        refreshData(controller.signal);

        // Poll every 30s
        const interval = setInterval(() => {
            const c = new AbortController();
            refreshData(c.signal);
        }, 30000);

        // Revalidate on focus / when tab becomes visible
        const onFocus = () => refreshData();
        const onVisible = () => {
            if (!document.hidden) refreshData();
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

    const getActivityIcon = (type: Activity["type"]): JSX.Element => {
        switch (type) {
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
                    <h2 className="inline-flex items-center gap-2 text-2xl font-bold text-gray-900">
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

            {showConnectionProblem && (
                <Warning
                    title="Connection Problem"
                    error="Unable to connect to SpiceDB. Please check your connection settings."
                />
            )}

            {isLoading && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <div className="animate-spin mr-2"><IconRefreshDot /></div>
                        <span className="text-blue-700">Loading dashboard data...</span>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">


                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div
                                    className={`w-3 h-3 rounded-full ${stats.isConnected ? "bg-green-400" : "bg-red-400"
                                        }`}
                                    aria-label={stats.isConnected ? "Connected" : "Disconnected"}
                                />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Status</dt>
                                    <dd
                                        className={`text-lg font-medium ${stats.isConnected ? "text-green-600" : "text-red-600"
                                            }`}
                                    >
                                        {stats.isConnected ? "Connected" : "Disconnected"}
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <IconBuilding size={24} stroke={1.8} className="text-gray-700" aria-hidden />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Namespaces</dt>
                                    <dd className="text-lg font-medium text-gray-900">{stats.totalNamespaces}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Activity</h3>
                    {recentActivity.length > 0 ? (
                        <div className="flow-root">
                            <ul className="-mb-8">
                                {recentActivity.map((activity, idx) => (
                                    <li key={activity.id}>
                                        <div className="relative pb-8">
                                            {idx !== recentActivity.length - 1 ? (
                                                <span
                                                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                                                    aria-hidden="true"
                                                />
                                            ) : null}
                                            <div className="relative flex space-x-3">
                                                <div>
                                                    <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                                                        <span className="text-sm text-gray-700" aria-hidden>
                                                            {getActivityIcon(activity.type)}
                                                        </span>
                                                    </span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm text-gray-900">
                                                        {activity.title ?? activity.type}
                                                    </p>
                                                    {activity.description && (
                                                        <p className="text-sm text-gray-500">{activity.description}</p>
                                                    )}
                                                    {activity.createdAt && (
                                                        <p className="text-xs text-gray-400 mt-1">
                                                            {new Date(activity.createdAt).toLocaleString()}
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
                        <p className="text-gray-500">No recent activity</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;