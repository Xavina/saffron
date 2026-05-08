import type { NextPage } from "next";
import { useEffect, useRef, useState } from "react";
import {
    IconBuilding,
    IconLink,
    IconCircleCheck,
    IconLayoutDashboard,
    IconUsers,
    IconX,
    IconHash,
    IconClock,
    IconList,
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

const Dashboard: NextPage = () => {
    const [stats, setStats] = useState<Stats>({
        totalNamespaces: 0,
        totalRelationships: 0,
        totalSubjects: 0,
        lastUpdate: null,
        isConnected: false, // Start with unknown/false state
    });

    const [error, setError] = useState<string>("");

    // Ignore stale async responses
    const requestIdRef = useRef(0);

    const refreshData = async (signal?: AbortSignal) => {
        const rid = ++requestIdRef.current;
        setError("");

        try {
            // Add timeout to all fetch calls - 5 seconds max
            const fetchWithTimeout = (url: string, options: RequestInit): Promise<Response> => {
                const timeout = 5000;
                return Promise.race([
                    fetch(url, options),
                    new Promise<Response>((_, reject) => 
                        setTimeout(() => reject(new Error('Request timeout')), timeout)
                    )
                ]);
            };
            
            const [statsRes, healthRes] = await Promise.allSettled([
                fetchWithTimeout("/api/spicedb/stats", { signal }),
                fetchWithTimeout("/api/spicedb/health", { signal }),
            ]).then(results => results.map(r => 
                r.status === 'fulfilled' ? r.value as Response : null
            )) as [Response | null, Response | null];

            if (rid !== requestIdRef.current) return; // a newer request finished already

            // Stats - don't throw on failure, just use defaults
            let statsData = {
                totalNamespaces: 0,
                totalRelationships: 0,
                totalSubjects: 0,
                lastUpdate: null,
                schemaHash: null,
                apiResponseTime: null,
                namespacesWithRelationCounts: []
            };
            
            if (statsRes && statsRes.ok) {
                try {
                    statsData = await statsRes.json();
                } catch (e) {
                    console.error('Failed to parse stats:', e);
                }
            }

            // Health is source of truth for connection
            let connected = false;
            
            // Check health status
            if (healthRes && healthRes.ok) {
                try {
                    const healthData = await healthRes.json();
                    connected = !!healthData.connected;
                    console.log('Health check result:', { connected, healthData });
                } catch (e) {
                    connected = false;
                    console.error('Failed to parse health response:', e);
                }
            } else {
                // Health check failed or timed out - we're disconnected
                connected = false;
                console.log('Health check failed:', { healthRes });
            }
            
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
        } catch {
            if (signal?.aborted) return;
            // Don't show errors, just let the disconnected status show
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        refreshData(controller.signal);

        // Poll every 30s (silent)
        const interval = setInterval(() => {
            const c = new AbortController();
            refreshData(c.signal);
        }, 30000);

        // Revalidate on focus / when tab becomes visible (silent)
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
                                    <IconCircleCheck size={48} stroke={1.8} className="text-orange-300" aria-hidden />
                                ) : (
                                        <IconX size={48} stroke={1.8} className="text-orange-300" aria-hidden />
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
                                <IconBuilding size={48} stroke={1.8} className="text-orange-300" aria-hidden />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-zinc-400 truncate">Namespaces</dt>
                                    <dd className="text-xl flex mt-1 p-1 bg-purple-600 text-zinc-100 font-bold text-zinc-100 rounded-lg w-40 justify-center items-center text-white">{stats.isConnected ? stats.totalNamespaces : '--'}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <IconLink size={48} stroke={1.8} className="text-orange-300" aria-hidden />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-zinc-400 truncate">Relationships</dt>
                                    <dd className="text-xl flex mt-1 p-1 bg-purple-600 text-zinc-100 font-bold rounded-lg w-40 justify-center items-center text-white">{stats.isConnected ? stats.totalRelationships : '--'}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <IconUsers size={48} stroke={1.8} className="text-orange-300" aria-hidden />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-zinc-400 truncate">Subjects</dt>
                                    <dd className="text-xl flex mt-1 p-1 bg-purple-600 text-zinc-100 font-bold rounded-lg w-40 justify-center items-center text-white">{stats.isConnected ? stats.totalSubjects : '--'}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-700">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <IconHash size={48} stroke={1.8} className="text-orange-300" aria-hidden />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-zinc-400 truncate">Schema Hash</dt>
                                    <dd className="text-xl flex mt-1 p-1 bg-purple-600 text-zinc-100 font-bold rounded-lg w-40 justify-center items-center text-white">
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
                                <IconClock size={48} stroke={1.8} className="text-orange-300" aria-hidden />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-zinc-400 truncate">Average API Response</dt>
                                    <dd className="text-xl flex mt-1 p-1 bg-purple-600 text-zinc-100 font-bold rounded-lg w-40 justify-center items-center text-white">
                                        {stats.isConnected ? (stats.apiResponseTime ? `${stats.apiResponseTime}ms` : 'N/A') : '--'}
                                    </dd>
                                </dl>
                            </div>
                        </div>
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
                                    <h4 className="font-medium text-white mb-2 p-2 bg-blue-100 text-zinc-100 font-bold rounded-md justify-center items-center text-white">{ns.namespace}</h4>
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