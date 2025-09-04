import { useState, useEffect } from 'react';
import Layout from '../components/Layout';

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalNamespaces: 0,
        totalRelationships: 0,
        totalSubjects: 0,
        lastUpdate: null,
        isConnected: false
    });

    const [recentActivity, setRecentActivity] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    // Load real stats from SpiceDB
    const loadStats = async () => {
        try {
            const response = await fetch('/api/spicedb/stats');
            if (response.ok) {
                const data = await response.json();
                setStats({
                    totalNamespaces: data.totalNamespaces,
                    totalRelationships: data.totalRelationships,
                    totalSubjects: data.totalSubjects,
                    lastUpdate: new Date(data.lastUpdate).toLocaleString(),
                    isConnected: data.isConnected
                });
            } else {
                setError('Failed to load stats');
            }
        } catch (err) {
            setError('Connection error');
            setStats(prev => ({ ...prev, isConnected: false }));
        }
    };

    // Load real activity from SpiceDB
    const loadActivity = async () => {
        try {
            const response = await fetch('/api/spicedb/activity');
            if (response.ok) {
                const data = await response.json();
                setRecentActivity(data.activities || []);
            }
        } catch (err) {
            console.error('Failed to load activity:', err);
            // Keep empty array if fails
        }
    };

    // Test connection health
    const testConnection = async () => {
        try {
            const response = await fetch('/api/spicedb/health');
            if (response.ok) {
                const data = await response.json();
                setStats(prev => ({ ...prev, isConnected: data.connected }));
            }
        } catch (error) {
            setStats(prev => ({ ...prev, isConnected: false }));
        }
    };

    useEffect(() => {
        const loadDashboardData = async () => {
            setIsLoading(true);
            await Promise.all([
                loadStats(),
                loadActivity(),
                testConnection()
            ]);
            setIsLoading(false);
        };

        loadDashboardData();

        // Refresh data every 30 seconds
        const interval = setInterval(loadDashboardData, 30000);
        return () => clearInterval(interval);
    }, []);

    const refreshData = async () => {
        setIsLoading(true);
        await Promise.all([
            loadStats(),
            loadActivity(),
            testConnection()
        ]);
        setIsLoading(false);
    };

    const getActivityIcon = (type) => {
        switch (type) {
            case 'schema': return '🏗️';
            case 'relationship': return '🔗';
            case 'check': return '✅';
            case 'system': return '⚙️';
            case 'error': return '❌';
            default: return '📝';
        }
    };

    return (
        <Layout>
            <div className="space-y-6">
                {/* Error Alert */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center">
                            <span className="text-red-600 mr-2">❌</span>
                            <div>
                                <h3 className="text-sm font-medium text-red-800">Error</h3>
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Connection Status Alert */}
                {!stats.isConnected && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center">
                            <span className="text-yellow-600 mr-2">⚠️</span>
                            <div>
                                <h3 className="text-sm font-medium text-yellow-800">Connection Warning</h3>
                                <p className="text-sm text-yellow-700">Unable to connect to SpiceDB. Please check your connection settings.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                            <span className="text-blue-700">Loading dashboard data...</span>
                        </div>
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="p-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <span className="text-2xl">🏗️</span>
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

                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="p-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <div className={`w-3 h-3 rounded-full ${stats.isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-gray-500 truncate">Status</dt>
                                        <dd className={`text-lg font-medium ${stats.isConnected ? 'text-green-600' : 'text-red-600'}`}>
                                            {stats.isConnected ? 'Connected' : 'Disconnected'}
                                        </dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <a
                                href="/schema"
                                className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <span className="mr-2">🏗️</span>
                                Edit Schema
                            </a>
                            <a
                                href="/relationships"
                                className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <span className="mr-2">🔗</span>
                                Add Relationship
                            </a>
                            <a
                                href="/check"
                                className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <span className="mr-2">✅</span>
                                Check Permission
                            </a>
                            <button
                                onClick={refreshData}
                                disabled={isLoading}
                                className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                <span className="mr-2">🔄</span>
                                {isLoading ? 'Refreshing...' : 'Refresh Data'}
                            </button>
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
                                    {recentActivity.map((activity, activityIdx) => (
                                        <li key={activity.id}>
                                            <div className="relative pb-8">
                                                {activityIdx !== recentActivity.length - 1 ? (
                                                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                                                ) : null}
                                                <div className="relative flex space-x-3">
                                                    <div>
                            <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                              <span className="text-sm">{getActivityIcon(activity.type)}</span>
                            </span>
                                                    </div>
                                                    <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                                        <div>
                                                            <p className="text-sm text-gray-900">
                                                                <span className="font-medium">{activity.action}</span>
                                                                {activity.resource && (
                                                                    <span className="ml-2 text-gray-500">
                                    <code className="text-xs bg-gray-100 px-1 py-0.5 rounded break-all">
                                      {activity.resource.length > 50
                                          ? `${activity.resource.substring(0, 50)}...`
                                          : activity.resource}
                                    </code>
                                  </span>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                                            <time>{activity.timestamp}</time>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <div className="text-center py-4">
                                <span className="text-gray-500">No recent activity</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Last Update */}
                {stats.lastUpdate && (
                    <div className="text-center text-sm text-gray-500">
                        Last updated: {stats.lastUpdate}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Dashboard;