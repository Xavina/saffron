import { useState, useEffect } from 'react';
import Layout from '../components/Layout';

const Permissions = () => {
    const [checkHistory, setCheckHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [checkForm, setCheckForm] = useState({
        resource: '',
        permission: '',
        subject: ''
    });
    const [bulkCheck, setBulkCheck] = useState({
        resource: '',
        permission: '',
        subjects: ''
    });
    const [activeTab, setActiveTab] = useState('single');
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    const performSingleCheck = async () => {
        if (!checkForm.resource || !checkForm.permission || !checkForm.subject) {
            setError('All fields are required');
            return;
        }

        setIsLoading(true);
        setError('');
        setResult(null);

        try {
            const [resourceType, resourceId] = checkForm.resource.split(':');
            const [subjectType, subjectId] = checkForm.subject.split(':');

            if (!resourceType || !resourceId || !subjectType || !subjectId) {
                throw new Error('Invalid format. Use type:id format');
            }

            // This would be your actual SpiceDB API call
            // const response = await fetch('/api/spicedb/check', {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify({
            //     resource: { type: resourceType, id: resourceId },
            //     permission: checkForm.permission,
            //     subject: { type: subjectType, id: subjectId }
            //   })
            // });

            // Mock response
            setTimeout(() => {
                const mockResult = Math.random() > 0.5 ? 'ALLOWED' : 'DENIED';
                const checkResult = {
                    id: Date.now().toString(),
                    resource: { type: resourceType, id: resourceId },
                    permission: checkForm.permission,
                    subject: { type: subjectType, id: subjectId },
                    result: mockResult,
                    timestamp: new Date().toISOString(),
                    duration: `${Math.floor(Math.random() * 5) + 1}ms`
                };

                setResult(checkResult);
                setCheckHistory([checkResult, ...checkHistory]);
                setIsLoading(false);
            }, 800);

        } catch (err) {
            setError(err.message || 'Failed to perform permission check');
            setIsLoading(false);
        }
    };

    const performBulkCheck = async () => {
        if (!bulkCheck.resource || !bulkCheck.permission || !bulkCheck.subjects) {
            setError('All fields are required');
            return;
        }

        setIsLoading(true);
        setError('');
        setResult(null);

        try {
            const [resourceType, resourceId] = bulkCheck.resource.split(':');
            const subjects = bulkCheck.subjects.split('\n').filter(s => s.trim());

            if (!resourceType || !resourceId) {
                throw new Error('Invalid resource format. Use type:id format');
            }

            // Mock bulk check results
            setTimeout(() => {
                const bulkResults = subjects.map((subjectStr, index) => {
                    const [subjectType, subjectId] = subjectStr.trim().split(':');
                    return {
                        id: `${Date.now()}-${index}`,
                        resource: { type: resourceType, id: resourceId },
                        permission: bulkCheck.permission,
                        subject: { type: subjectType, id: subjectId },
                        result: Math.random() > 0.5 ? 'ALLOWED' : 'DENIED',
                        timestamp: new Date().toISOString(),
                        duration: `${Math.floor(Math.random() * 5) + 1}ms`
                    };
                });

                setResult({ type: 'bulk', results: bulkResults });
                setCheckHistory([...bulkResults, ...checkHistory]);
                setIsLoading(false);
            }, 1000);

        } catch (err) {
            setError(err.message || 'Failed to perform bulk permission check');
            setIsLoading(false);
        }
    };

    const clearHistory = () => {
        setCheckHistory([]);
        setResult(null);
    };

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString();
    };

    const getResultColor = (result) => {
        return result === 'ALLOWED'
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800';
    };

    const getResultIcon = (result) => {
        return result === 'ALLOWED' ? '✅' : '❌';
    };

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Permission Checks</h2>
                    <p className="text-gray-600">Test authorization queries against your SpiceDB instance</p>
                </div>

                {/* Tab Navigation */}
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab('single')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'single'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            Single Check
                        </button>
                        <button
                            onClick={() => setActiveTab('bulk')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'bulk'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            Bulk Check
                        </button>
                    </nav>
                </div>

                {/* Alerts */}
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

                {/* Single Check Tab */}
                {activeTab === 'single' && (
                    <div className="bg-white shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Single Permission Check</h3>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Resource
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., document:readme"
                                        value={checkForm.resource}
                                        onChange={(e) => setCheckForm({...checkForm, resource: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Permission
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., view, edit, delete"
                                        value={checkForm.permission}
                                        onChange={(e) => setCheckForm({...checkForm, permission: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Subject
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., user:alice"
                                        value={checkForm.subject}
                                        onChange={(e) => setCheckForm({...checkForm, subject: e.target.value})}
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
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Checking...
                                        </>
                                    ) : (
                                        <>
                                            <span className="mr-2">✅</span>
                                            Check Permission
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bulk Check Tab */}
                {activeTab === 'bulk' && (
                    <div className="bg-white shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Bulk Permission Check</h3>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Resource
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., document:readme"
                                        value={bulkCheck.resource}
                                        onChange={(e) => setBulkCheck({...bulkCheck, resource: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Permission
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., view, edit, delete"
                                        value={bulkCheck.permission}
                                        onChange={(e) => setBulkCheck({...bulkCheck, permission: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Subjects (one per line)
                                </label>
                                <textarea
                                    rows="6"
                                    placeholder={`user:alice\nuser:bob\nuser:charlie\norganization:acme`}
                                    value={bulkCheck.subjects}
                                    onChange={(e) => setBulkCheck({...bulkCheck, subjects: e.target.value})}
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
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Checking...
                                        </>
                                    ) : (
                                        <>
                                            <span className="mr-2">🔍</span>
                                            Bulk Check
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Latest Result */}
                {result && (
                    <div className="bg-white shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Latest Result</h3>

                            {result.type === 'bulk' ? (
                                <div className="space-y-2">
                                    <p className="text-sm text-gray-600 mb-3">
                                        Checked {result.results.length} subjects for permission <strong>{result.results[0]?.permission}</strong> on <strong>{result.results[0]?.resource.type}:{result.results[0]?.resource.id}</strong>
                                    </p>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                        {result.results.map((r) => (
                                            <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                <span className="text-sm font-medium">{r.subject.type}:{r.subject.id}</span>
                                                <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getResultColor(r.result)}`}>
                            {getResultIcon(r.result)} {r.result}
                          </span>
                                                    <span className="text-xs text-gray-500">{r.duration}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            {result.subject.type}:{result.subject.id} → {result.resource.type}:{result.resource.id}#{result.permission}
                                        </p>
                                        <p className="text-xs text-gray-500">Duration: {result.duration}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded text-sm font-medium ${getResultColor(result.result)}`}>
                    {getResultIcon(result.result)} {result.result}
                  </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Check History */}
                <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg leading-6 font-medium text-gray-900">
                                Check History ({checkHistory.length})
                            </h3>
                            {checkHistory.length > 0 && (
                                <button
                                    onClick={clearHistory}
                                    className="text-sm text-gray-500 hover:text-gray-700"
                                >
                                    Clear History
                                </button>
                            )}
                        </div>

                        {checkHistory.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Query
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Result
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Duration
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Time
                                        </th>
                                    </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                    {checkHistory.slice(0, 10).map((check) => (
                                        <tr key={check.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-mono text-gray-900">
                                                    {check.subject.type}:{check.subject.id} → {check.resource.type}:{check.resource.id}#{check.permission}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getResultColor(check.result)}`}>
                            {getResultIcon(check.result)} {check.result}
                          </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {check.duration}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatTimestamp(check.timestamp)}
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <div className="text-gray-400 text-lg mb-2">🔍</div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No checks performed yet</h3>
                                <p className="text-gray-500">Perform your first permission check to see the history</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Permissions;