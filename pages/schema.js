import { useState, useEffect } from 'react';
import Layout from '../components/Layout';

const Schema = () => {
    const [activeTab, setActiveTab] = useState('editor');
    const [schema, setSchema] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [namespaces, setNamespaces] = useState([]);

    useEffect(() => {
        // Load current schema
        loadSchema();
    }, []);

    useEffect(() => {
        // parse name spaces
        parseNamespaces();
    }, [schema]);

    const loadSchema = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch('/api/spicedb/schema');

            if (response.ok) {
                const data = await response.text();
                console.log("--data", data);
                setSchema(data);
            } else {
                const errorData = await response.json();
                // If no schema is defined, that's OK - just use empty or mock schema
                if (errorData.message?.includes('No schema has been defined')) {
                    setError('No schema defined yet. You can create one using the editor below.');
                } else {
                    setError(`Failed to load schema: ${errorData.message}`);
                }
            }
        } catch (err) {
            setError(`Connection error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const parseNamespaces = () => {
        // Parse namespaces from current schema
        const namespaceRegex = /definition\s+(\w+)\s*\{/g;
        const found = [];
        let match;

        while ((match = namespaceRegex.exec(schema)) !== null) {
            found.push({
                name: match[1],
                relations: extractRelations(match[1], schema),
                permissions: extractPermissions(match[1], schema)
            });
        }

        setNamespaces(found);
    };

    const extractRelations = (namespace, schemaText) => {
        const namespaceBlock = extractNamespaceBlock(namespace, schemaText);
        // Fixed regex: use [\s\S] to match any character including newlines, and make it non-greedy
        const relationRegex = /relation\s+(\w+):\s*([^\n\r]+)/g;
        const relations = [];
        let match;

        while ((match = relationRegex.exec(namespaceBlock)) !== null) {
            relations.push({
                name: match[1],
                type: match[2].trim()
            });
        }
        return relations;
    };

    const extractPermissions = (namespace, schemaText) => {
        const namespaceBlock = extractNamespaceBlock(namespace, schemaText);
        // Fixed regex: capture until newline or end of block
        const permissionRegex = /permission\s+(\w+)\s*=\s*([^\n\r]+)/g;
        const permissions = [];
        let match;

        while ((match = permissionRegex.exec(namespaceBlock)) !== null) {
            permissions.push({
                name: match[1],
                expression: match[2].trim()
            });
        }
        return permissions;
    };

    const extractNamespaceBlock = (namespace, schemaText) => {
        const startRegex = new RegExp(`definition\\s+${namespace}\\s*\\{`);
        const startMatch = schemaText.match(startRegex);
        if (!startMatch) return '';

        const startIndex = startMatch.index + startMatch[0].length;
        let braceCount = 1;
        let endIndex = startIndex;

        for (let i = startIndex; i < schemaText.length && braceCount > 0; i++) {
            if (schemaText[i] === '{') braceCount++;
            if (schemaText[i] === '}') braceCount--;
            endIndex = i;
        }

        return schemaText.substring(startIndex, endIndex);
    };

    const saveSchema = async () => {
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch('/api/spicedb/schema', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: schema
            });

            if (response.ok) {
                setSuccess('Schema updated successfully');
                parseNamespaces();
            } else {
                const errorData = await response.json();
                setError(`Failed to update schema: ${errorData.message}`);
            }
        } catch (err) {
            setError(`Connection error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Layout>
            <div className="space-y-6">
                {/* Tab Navigation */}
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab('editor')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'editor'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            Schema Editor
                        </button>
                        <button
                            onClick={() => setActiveTab('visual')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'visual'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            Visual View
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
                                <pre className="text-sm text-red-700 whitespace-pre-wrap">{error}</pre>
                            </div>
                        </div>
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center">
                            <span className="text-green-600 mr-2">✅</span>
                            <div>
                                <h3 className="text-sm font-medium text-green-800">Success</h3>
                                <p className="text-sm text-green-700">{success}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Schema Editor Tab */}
                {activeTab === 'editor' && (
                    <div className="bg-white shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">Schema Definition</h3>
                                <div className="flex space-x-3">
                                    <button
                                        onClick={loadSchema}
                                        disabled={isLoading}
                                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                    >
                                        {isLoading ? 'Loading...' : 'Reload'}
                                    </button>
                                    <button
                                        onClick={saveSchema}
                                        disabled={isLoading}
                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                    >
                                        {isLoading ? 'Saving...' : 'Save Schema'}
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4">
                <textarea
                    value={schema}
                    onChange={(e) => setSchema(e.target.value)}
                    className="w-full h-96 p-4 border border-gray-300 rounded-md font-mono text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your SpiceDB schema definition..."
                    style={{ fontFamily: 'Monaco, Consolas, "Courier New", monospace' }}
                />
                            </div>

                            <div className="mt-4 text-sm text-gray-500">
                                <p>
                                    <strong>Tip:</strong> Use the SpiceDB schema language to define your authorization model.
                                    Start with <code className="bg-gray-100 px-1 py-0.5 rounded">definition</code> blocks
                                    and define <code className="bg-gray-100 px-1 py-0.5 rounded">relation</code> and
                                    <code className="bg-gray-100 px-1 py-0.5 rounded">permission</code> statements.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Visual View Tab */}
                {activeTab === 'visual' && (
                    <div className="space-y-6">
                        {namespaces.map((namespace) => (
                            <div key={namespace.name} className="bg-white shadow rounded-lg">
                                <div className="px-4 py-5 sm:p-6">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium mr-2">
                      {namespace.name}
                    </span>
                                        Definition
                                    </h3>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Relations */}
                                        <div>
                                            <h4 className="text-md font-medium text-gray-700 mb-3">Relations</h4>
                                            {namespace.relations.length > 0 ? (
                                                <div className="space-y-2">
                                                    {namespace.relations.map((relation, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                            <div>
                                                                <span className="font-medium text-gray-900">{relation.name}</span>
                                                                <span className="text-gray-500 ml-2">: {relation.type}</span>
                                                            </div>
                                                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">relation</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-gray-500 italic">No relations defined</p>
                                            )}
                                        </div>

                                        {/* Permissions */}
                                        <div>
                                            <h4 className="text-md font-medium text-gray-700 mb-3">Permissions</h4>
                                            {namespace.permissions.length > 0 ? (
                                                <div className="space-y-2">
                                                    {namespace.permissions.map((permission, idx) => (
                                                        <div key={idx} className="p-3 bg-green-50 rounded-lg">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="font-medium text-gray-900">{permission.name}</span>
                                                                <span className="text-xs bg-green-200 text-green-700 px-2 py-1 rounded">permission</span>
                                                            </div>
                                                            <div className="text-sm text-gray-600">
                                                                <code className="bg-white px-2 py-1 rounded text-xs">{permission.expression}</code>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-gray-500 italic">No permissions defined</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {namespaces.length === 0 && (
                            <div className="bg-white shadow rounded-lg p-8 text-center">
                                <div className="text-gray-400 text-lg mb-2">🏗️</div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No Schema Defined</h3>
                                <p className="text-gray-500">Switch to the Schema Editor tab to define your authorization model.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Schema;