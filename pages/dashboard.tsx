import type { NextPage } from "next";
import { useCallback, useEffect, useRef, useState } from "react";
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
    IconRefresh,
} from "@tabler/icons-react";
import Warning from "@/components/Warning";

const STATS_CACHE_KEY = "saffron:dashboard:stats";
const STATS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FULL_COUNT_CONCURRENCY = 2;

type NamespaceCount = {
    namespace: string;
    relationshipCount: number;
    subjectCount: number;
    relationTypes: string[];
    isApproximate?: boolean;
    isCounting?: boolean;
};

type Stats = {
    totalNamespaces: number;
    totalRelationships: number;
    totalSubjects: number;
    lastUpdate: string | null;
    isConnected: boolean;
    schemaHash?: string;
    apiResponseTime?: number;
    isApproximate?: boolean;
    namespacesWithRelationCounts?: NamespaceCount[];
};

type CachedStats = Stats & { cachedAt: number };

function loadCachedStats(): Stats | null {
    try {
        const raw = localStorage.getItem(STATS_CACHE_KEY);
        if (!raw) return null;
        const cached: CachedStats = JSON.parse(raw);
        return cached;
    } catch {
        return null;
    }
}

function saveStatsToCache(stats: Stats): void {
    try {
        const cached: CachedStats = { ...stats, cachedAt: Date.now() };
        localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(cached));
    } catch {
        // localStorage unavailable — silently skip
    }
}

function isCacheStale(): boolean {
    try {
        const raw = localStorage.getItem(STATS_CACHE_KEY);
        if (!raw) return true;
        const { cachedAt }: CachedStats = JSON.parse(raw);
        return Date.now() - cachedAt > STATS_CACHE_TTL_MS;
    } catch {
        return true;
    }
}

function mergeApproximateWithKnownFullCounts(nextStats: Stats, knownStats: Stats | null): Stats {
    const nextNamespaces = nextStats.namespacesWithRelationCounts ?? [];
    const knownNamespaces = knownStats?.namespacesWithRelationCounts ?? [];
    const schemaUnchanged = Boolean(
        nextStats.schemaHash
        && knownStats?.schemaHash
        && nextStats.schemaHash === knownStats.schemaHash,
    );

    if (!schemaUnchanged || nextNamespaces.length === 0 || knownNamespaces.length === 0) {
        return nextStats;
    }

    const exactCountsByNamespace = new Map(
        knownNamespaces
            .filter((ns) => !ns.isApproximate && !ns.isCounting)
            .map((ns) => [ns.namespace, ns]),
    );

    if (exactCountsByNamespace.size === 0) {
        return nextStats;
    }

    const mergedNamespaces = nextNamespaces.map((ns) => {
        if (!ns.isApproximate) {
            return ns;
        }

        const knownExact = exactCountsByNamespace.get(ns.namespace);
        if (!knownExact) {
            return ns;
        }

        return {
            ...ns,
            relationshipCount: knownExact.relationshipCount,
            subjectCount: knownExact.subjectCount,
            isApproximate: false,
            isCounting: false,
        };
    });

    return {
        ...nextStats,
        namespacesWithRelationCounts: mergedNamespaces,
        totalRelationships: mergedNamespaces.reduce((sum, ns) => sum + ns.relationshipCount, 0),
        totalSubjects: mergedNamespaces.reduce((sum, ns) => sum + ns.subjectCount, 0),
        isApproximate: mergedNamespaces.some((ns) => ns.isApproximate),
    };
}

const EMPTY_STATS: Stats = {
    totalNamespaces: 0,
    totalRelationships: 0,
    totalSubjects: 0,
    lastUpdate: null,
    isConnected: false,
};

const Dashboard: NextPage = () => {
    const [stats, setStats] = useState<Stats>(EMPTY_STATS);
    const [isLoading, setIsLoading] = useState(true);

    const [error, setError] = useState<string>("");

    // Ignore stale async responses
    const requestIdRef = useRef(0);
    // Track in-progress background full-count AbortControllers per namespace
    const bgCountersRef = useRef<Map<string, AbortController>>(new Map());
    // Track full-count batch generations to avoid stale batch workers
    const fullCountGenerationRef = useRef(0);

    const fetchFullCount = useCallback(async (nsName: string, signal: AbortSignal) => {
        try {
            const res = await fetch(`/api/spicedb/namespace-count?namespace=${encodeURIComponent(nsName)}`, { signal });
            if (!res.ok) throw new Error(`Failed to fetch full count for ${nsName}`);
            if (signal.aborted) return;
            const data: { namespace: string; relationshipCount: number; subjectCount: number; isApproximate: boolean } = await res.json();
            if (signal.aborted) return;
            setStats(prev => {
                const ns = prev.namespacesWithRelationCounts ?? [];
                const updated = ns.map(n =>
                    n.namespace === nsName
                        ? { ...n, relationshipCount: data.relationshipCount, subjectCount: data.subjectCount, isApproximate: data.isApproximate, isCounting: false }
                        : n,
                );
                // Recompute totals
                const newRelCount = updated.reduce((sum, n) => sum + n.relationshipCount, 0);
                const newSubCount = updated.reduce((sum, n) => sum + n.subjectCount, 0);
                const freshStats: Stats = {
                    ...prev,
                    namespacesWithRelationCounts: updated,
                    totalRelationships: newRelCount,
                    totalSubjects: newSubCount,
                    isApproximate: updated.some((n) => n.isApproximate),
                };
                saveStatsToCache(freshStats);
                return freshStats;
            });
        } catch {
            // aborted or network error — mark isCounting: false
            if (!signal.aborted) {
                setStats(prev => ({
                    ...prev,
                    namespacesWithRelationCounts: (prev.namespacesWithRelationCounts ?? []).map(n =>
                        n.namespace === nsName ? { ...n, isCounting: false } : n,
                    ),
                }));
            }
        } finally {
            bgCountersRef.current.delete(nsName);
        }
    }, []);

    const runBackgroundFullCounts = useCallback(async (namespaces: NamespaceCount[], generation: number) => {
        const approximateNamespaces = namespaces
            .filter((ns) => ns.isApproximate)
            .map((ns) => ns.namespace);

        for (let i = 0; i < approximateNamespaces.length; i += FULL_COUNT_CONCURRENCY) {
            if (generation !== fullCountGenerationRef.current) {
                return;
            }

            const batch = approximateNamespaces.slice(i, i + FULL_COUNT_CONCURRENCY);
            const batchWork = batch.map((nsName) => {
                const ac = new AbortController();
                bgCountersRef.current.set(nsName, ac);
                return fetchFullCount(nsName, ac.signal);
            });

            await Promise.allSettled(batchWork);
        }
    }, [fetchFullCount]);

    const refreshData = async (signal?: AbortSignal) => {
        const rid = ++requestIdRef.current;
        setError("");
        setIsLoading(true);

        try {
            // Add timeout to all fetch calls - 15 seconds max (stats can be slow with large datasets)
            const fetchWithTimeout = (url: string, options: RequestInit): Promise<Response> => {
                const timeout = 15000;
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
            let statsData: {
                totalNamespaces: number;
                totalRelationships: number;
                totalSubjects: number;
                lastUpdate: string | null;
                schemaHash: string | null;
                apiResponseTime: number | null;
                isApproximate: boolean;
                namespacesWithRelationCounts: any[];
            } = {
                totalNamespaces: 0,
                totalRelationships: 0,
                totalSubjects: 0,
                lastUpdate: null,
                schemaHash: null,
                apiResponseTime: null,
                isApproximate: false,
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
            
            const freshStats: Stats = {
                totalNamespaces: statsData.totalNamespaces ?? 0,
                totalRelationships: statsData.totalRelationships ?? 0,
                totalSubjects: statsData.totalSubjects ?? 0,
                lastUpdate: statsData.lastUpdate ? new Date(statsData.lastUpdate).toLocaleString() : null,
                isConnected: connected,
                schemaHash: statsData.schemaHash,
                apiResponseTime: statsData.apiResponseTime,
                isApproximate: statsData.isApproximate ?? false,
                namespacesWithRelationCounts: (statsData.namespacesWithRelationCounts ?? []).map(
                    (n: NamespaceCount) => ({ ...n, isCounting: n.isApproximate ?? false }),
                ),
            };
            const mergedStats = mergeApproximateWithKnownFullCounts(freshStats, loadCachedStats());
            setStats(mergedStats);
            saveStatsToCache(mergedStats);
            setIsLoading(false);

            // Abort any previous background full-count fetches
            fullCountGenerationRef.current += 1;
            bgCountersRef.current.forEach(ac => ac.abort());
            bgCountersRef.current.clear();

            // Start background full-count for approximate namespaces
            const generation = fullCountGenerationRef.current;
            void runBackgroundFullCounts(mergedStats.namespacesWithRelationCounts ?? [], generation);
        } catch {
            if (signal?.aborted) return;
            setIsLoading(false);
            // Don't show errors, just let the disconnected status show
        }
    };

    useEffect(() => {
        // Hydrate immediately from localStorage cache so counters aren't zero
        const cached = loadCachedStats();
        if (cached) {
            setStats(cached);
        }

        const controller = new AbortController();

        // Always fetch fresh data in background; skip only if cache is fresh enough
        if (isCacheStale() || !cached) {
            refreshData(controller.signal);
        } else {
            setIsLoading(false);
            // Still refresh silently after a short delay so connection status is live
            const t = setTimeout(() => refreshData(controller.signal), 500);
            return () => {
                controller.abort();
                clearTimeout(t);
            };
        }

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
            fullCountGenerationRef.current += 1;
            bgCountersRef.current.forEach(ac => ac.abort());
            bgCountersRef.current.clear();
        };
    }, [runBackgroundFullCounts]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="inline-flex items-center gap-2 text-2xl font-bold text-[var(--saffron-text-primary)]">
                        <IconLayoutDashboard className="text-[var(--saffron-warning-strong)]" size={30} aria-hidden />
                        Dashboard
                    </h2>
                    <p className="text-[var(--saffron-text-muted)] flex items-center gap-2">
                        Overview of your database.
                        {isLoading && (
                            <span className="inline-flex items-center gap-1 text-xs text-[var(--saffron-warning-strong)]">
                                <IconRefresh size={13} className="animate-spin" aria-hidden />
                                Updating stats…
                            </span>
                        )}
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
                <div className="bg-[var(--saffron-surface-panel)] overflow-hidden shadow rounded-lg border border-[var(--saffron-border-default)]">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                {stats.isConnected ? (
                                    <IconCircleCheck size={48} stroke={1.8} className="text-[var(--saffron-warning-strong)]" aria-hidden />
                                ) : (
                                        <IconX size={48} stroke={1.8} className="text-[var(--saffron-warning-strong)]" aria-hidden />
                                )}
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-[var(--saffron-text-muted)] truncate">Status</dt>
                                    <dd
                                        className={`text-lg font-medium ${stats.isConnected ? "text-[var(--saffron-success-strong)]" : "text-[var(--saffron-danger-strong)]"
                                            }`}
                                    >
                                        {stats.isConnected ? "Connected" : "Disconnected"}
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-[var(--saffron-surface-panel)] overflow-hidden shadow rounded-lg border border-[var(--saffron-border-default)]">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <IconBuilding size={48} stroke={1.8} className="text-[var(--saffron-warning-strong)]" aria-hidden />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-[var(--saffron-text-muted)] truncate">Namespaces</dt>
                                    <dd className="text-xl flex mt-1 p-1 bg-[var(--saffron-accent-strong)] rounded-lg w-40 justify-center items-center text-white gap-1">
                                        {isLoading && <IconRefresh size={14} className="animate-spin opacity-70 flex-shrink-0" aria-hidden />}
                                        {stats.isConnected ? stats.totalNamespaces : '--'}
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-[var(--saffron-surface-panel)] overflow-hidden shadow rounded-lg border border-[var(--saffron-border-default)]">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <IconLink size={48} stroke={1.8} className="text-[var(--saffron-warning-strong)]" aria-hidden />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-[var(--saffron-text-muted)] truncate">Relationships</dt>
                                    <dd className="text-xl flex mt-1 p-1 bg-[var(--saffron-accent-strong)] rounded-lg w-40 justify-center items-center text-white gap-1">
                                        {isLoading && <IconRefresh size={14} className="animate-spin opacity-70 flex-shrink-0" aria-hidden />}
                                        {stats.isConnected ? `${stats.isApproximate ? '≥' : ''}${stats.totalRelationships}` : '--'}
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-[var(--saffron-surface-panel)] overflow-hidden shadow rounded-lg border border-[var(--saffron-border-default)]">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <IconUsers size={48} stroke={1.8} className="text-[var(--saffron-warning-strong)]" aria-hidden />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-[var(--saffron-text-muted)] truncate">Subjects</dt>
                                    <dd className="text-xl flex mt-1 p-1 bg-[var(--saffron-accent-strong)] rounded-lg w-40 justify-center items-center text-white gap-1">
                                        {isLoading && <IconRefresh size={14} className="animate-spin opacity-70 flex-shrink-0" aria-hidden />}
                                        {stats.isConnected ? `${stats.isApproximate ? '≥' : ''}${stats.totalSubjects}` : '--'}
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-[var(--saffron-surface-panel)] overflow-hidden shadow rounded-lg border border-[var(--saffron-border-default)]">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <IconHash size={48} stroke={1.8} className="text-[var(--saffron-warning-strong)]" aria-hidden />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-[var(--saffron-text-muted)] truncate">Schema Hash</dt>
                                    <dd className="text-xl flex mt-1 p-1 bg-[var(--saffron-accent-strong)] rounded-lg w-40 justify-center items-center text-white gap-1">
                                        {isLoading && <IconRefresh size={14} className="animate-spin opacity-70 flex-shrink-0" aria-hidden />}
                                        {stats.isConnected ? (stats.schemaHash ? stats.schemaHash.slice(0, 8) : 'N/A') : '--'}
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-[var(--saffron-surface-panel)] overflow-hidden shadow rounded-lg border border-[var(--saffron-border-default)]">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <IconClock size={48} stroke={1.8} className="text-[var(--saffron-warning-strong)]" aria-hidden />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-[var(--saffron-text-muted)] truncate">Average API Response</dt>
                                    <dd className="text-xl flex mt-1 p-1 bg-[var(--saffron-accent-strong)] rounded-lg w-40 justify-center items-center text-white gap-1">
                                        {isLoading && <IconRefresh size={14} className="animate-spin opacity-70 flex-shrink-0" aria-hidden />}
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
                <div className="bg-[var(--saffron-surface-panel)] shadow rounded-lg border border-[var(--saffron-border-default)]">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-[var(--saffron-text-primary)] mb-4 flex items-center gap-2">
                            <IconList size={20} className="text-[var(--saffron-text-muted)]" />
                            Namespace Details
                            {isLoading && <IconRefresh size={14} className="animate-spin text-orange-300 ml-1" aria-hidden />}
                        </h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
                            {stats.namespacesWithRelationCounts.map((ns) => (
                                <div key={ns.namespace} className="border border-[var(--saffron-border-subtle)] rounded-lg bg-[var(--saffron-surface-raised)] p-4">
                                    <h4 className="font-medium text-[var(--saffron-accent-text)] mb-2 p-2 bg-[var(--saffron-accent-soft)] rounded-md justify-center items-center flex items-center gap-2">
                                        {ns.namespace}
                                        {ns.isCounting && <IconRefresh size={14} className="animate-spin ml-auto opacity-70" />}
                                    </h4>
                                    <div className="space-y-1 text-sm text-[var(--saffron-text-muted)]">
                                        <div>Relationships: <span className="font-medium text-[var(--saffron-text-primary)]">{ns.isCounting ? '≥' : (ns.isApproximate ? '≥' : '')}{ns.relationshipCount}</span>{ns.isCounting && <span className="ml-1 text-xs text-[var(--saffron-text-subtle)]">counting…</span>}</div>
                                        <div>Subjects: <span className="font-medium text-[var(--saffron-text-primary)]">{ns.isCounting ? '≥' : (ns.isApproximate ? '≥' : '')}{ns.subjectCount}</span></div>
                                        <div>Relations: <span className="font-medium text-[var(--saffron-text-primary)]">{ns.relationTypes.join(', ')}</span></div>
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
