import type { NextPage } from "next";
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { IconBulb, IconCircleCheck, IconCode, IconDeviceFloppy, IconReload } from "@tabler/icons-react";
import Warning from "@/components/Warning";

type NamespaceInfo = {
    name: string;
    relations: { name: string; type: string }[];
    permissions: { name: string; expression: string }[];
};

const SchemaPage: NextPage = () => {
    const [activeTab, setActiveTab] = useState<"editor" | "visual">("editor");
    const [schema, setSchema] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [success, setSuccess] = useState<string>("");
    const [namespaces, setNamespaces] = useState<NamespaceInfo[]>([]);

    useEffect(() => {
        loadSchema();
    }, []);

    useEffect(() => {
        parseNamespaces();
    }, [schema]);

    const loadSchema = async () => {
        setIsLoading(true);
        setError("");
        try {
            const res = await fetch("/api/spicedb/schema");
            if (res.ok) {
                const text = await res.text();
                setSchema(text);
            } else {
                const errorData = await res.json();
                if (errorData.message?.includes("No schema has been defined")) {
                    setError("No schema defined yet. You can create one using the editor below.");
                } else {
                    setError(`Failed to load schema: ${errorData.message}`);
                }
            }
        } catch (err: any) {
            setError(`Connection error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const extractNamespaceBlock = (ns: string, txt: string) => {
        const startRegex = new RegExp(`definition\\s+${ns}\\s*\\{`);
        const startMatch = txt.match(startRegex);
        if (!startMatch || startMatch.index === undefined) return "";
        const startIndex = startMatch.index + startMatch[0].length;
        let braceCount = 1;
        let endIndex = startIndex;
        for (let i = startIndex; i < txt.length && braceCount > 0; i++) {
            if (txt[i] === "{") braceCount++;
            if (txt[i] === "}") braceCount--;
            endIndex = i;
        }
        return txt.substring(startIndex, endIndex);
    };

    const extractRelations = (ns: string, txt: string) => {
        const block = extractNamespaceBlock(ns, txt);
        const relationRegex = /relation\s+(\w+):\s*([^\n\r]+)/g;
        const relations: NamespaceInfo["relations"] = [];
        let m: RegExpExecArray | null;
        while ((m = relationRegex.exec(block)) !== null) {
            relations.push({ name: m[1], type: m[2].trim() });
        }
        return relations;
    };

    const extractPermissions = (ns: string, txt: string) => {
        const block = extractNamespaceBlock(ns, txt);
        const permissionRegex = /permission\s+(\w+)\s*=\s*([^\n\r]+)/g;
        const permissions: NamespaceInfo["permissions"] = [];
        let m: RegExpExecArray | null;
        while ((m = permissionRegex.exec(block)) !== null) {
            permissions.push({ name: m[1], expression: m[2].trim() });
        }
        return permissions;
    };

    const parseNamespaces = () => {
        const namespaceRegex = /definition\s+(\w+)\s*\{/g;
        const found: NamespaceInfo[] = [];
        let match: RegExpExecArray | null;
        while ((match = namespaceRegex.exec(schema)) !== null) {
            found.push({
                name: match[1],
                relations: extractRelations(match[1], schema),
                permissions: extractPermissions(match[1], schema),
            });
        }
        setNamespaces(found);
    };

    const saveSchema = async () => {
        setIsLoading(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch("/api/spicedb/schema", {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: schema,
            });
            if (res.ok) {
                setSuccess("Schema updated successfully");
                parseNamespaces();
            } else {
                const errorData = await res.json();
                setError(`Failed to update schema: ${errorData.message}`);
            }
        } catch (err: any) {
            setError(`Connection error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="inline-flex items-center gap-2 text-2xl font-bold text-gray-900">
                        <IconCode className="text-orange-300" size={30} aria-hidden />
                        Schema
                    </h2>
                    <p className="text-gray-400">
                        Develop your schema using the SpiceDB schema language.
                    </p>
                </div>
            </div>
            {error && (
                <Warning
                    title="Schema Definition Missing"
                    error={error}
                />
            )}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab("editor")}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "editor"
                            ? "border-blue-500 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                    >
                        Schema Editor
                    </button>
                    <button
                        onClick={() => setActiveTab("visual")}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "visual"
                            ? "border-blue-500 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                    >
                        Visual View
                    </button>
                </nav>
            </div>

            {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <span className="text-green-600 mr-2"><IconCircleCheck /></span>
                        <div>
                            <h3 className="text-sm font-medium text-green-800">Success</h3>
                            <p className="text-sm text-green-700">{success}</p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "editor" && (
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
                                    <IconReload className="mr-2" />
                                    {isLoading ? "Loading..." : "Refresh"}
                                </button>
                                <button
                                    onClick={saveSchema}
                                    disabled={isLoading}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                ><IconDeviceFloppy className="mr-2" />
                                    {isLoading ? "Saving..." : "Save Schema"}
                                </button>
                            </div>
                        </div>

                        <div className="mt-4">
                            <textarea
                                value={schema}
                                onChange={(e) => setSchema(e.target.value)}
                                className="w-full h-96 p-4 bg-gray-100 border border-gray-300 rounded-md font-mono text-sm focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter your SpiceDB schema definition..."
                                style={{ fontFamily: 'Monaco, Consolas, "Courier New", monospace' }}
                            />
                        </div>
                        <div className="text-sm text-gray-500">
                            <p className="text-xs text-gray-500 inline-flex items-center gap-2 text-gray-900 mt-2">
                                <IconBulb className="text-yellow-600" /><strong>Tip:</strong> Use the SpiceDB schema language to define your authorization model. Start with{" "}
                                <code className="bg-gray-100 px-1 py-0.5 rounded">definition</code> blocks and define{" "}
                                <code className="bg-gray-100 px-1 py-0.5 rounded">relation</code> and{" "}
                                <code className="bg-gray-100 px-1 py-0.5 rounded">permission</code> statements.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "visual" && (
                <div className="space-y-6">
                    {namespaces.map((ns) => (
                        <div key={ns.name} className="bg-white shadow rounded-lg">
                            <div className="px-4 py-5 sm:p-6">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium mr-2">{ns.name}</span>
                                    Definition
                                </h3>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="text-md font-medium text-gray-700 mb-3">Relations</h4>
                                        {ns.relations.length ? (
                                            <div className="space-y-2">
                                                {ns.relations.map((r, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                        <div>
                                                            <span className="font-medium text-gray-900">{r.name}</span>
                                                            <span className="text-gray-500 ml-2">: {r.type}</span>
                                                        </div>
                                                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">relation</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 italic">No relations defined</p>
                                        )}
                                    </div>

                                    <div>
                                        <h4 className="text-md font-medium text-gray-700 mb-3">Permissions</h4>
                                        {ns.permissions.length ? (
                                            <div className="space-y-2">
                                                {ns.permissions.map((p, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                        <div>
                                                            <span className="font-medium text-gray-900">{p.name}</span>
                                                            <span className="text-gray-500 ml-2">= {p.expression}</span>
                                                        </div>
                                                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">permission</span>
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
                    {!namespaces.length && <p className="text-gray-500">No namespaces parsed yet.</p>}
                </div>
            )}
        </div>
    );
};

export default SchemaPage;
