import type { NextPage } from "next";
import { useEffect, useState } from "react";
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import Layout from "../components/Layout";
import { IconBulb, IconCircleCheck, IconCode, IconDeviceFloppy, IconReload } from "@tabler/icons-react";
import SchemaGraph from "@/components/SchemaGraph";
import Warning from "@/components/Warning";

// Simple SpiceDB schema language mode
const spicedbMode = StreamLanguage.define({
    token(stream) {
        // Skip whitespace
        if (stream.eatSpace()) return null;

        // Comments
        if (stream.match('//')) {
            stream.skipToEnd();
            return 'comment';
        }

        // Keywords
        if (stream.match(/^(definition|relation|permission)\b/)) {
            return 'keyword';
        }

        // Operators and special chars
        if (stream.match(/^[{}()\[\]:=+\-|#]/)) {
            return 'operator';
        }

        // Strings
        if (stream.match(/^"(?:[^"\\]|\\.)*"/)) {
            return 'string';
        }

        // Identifiers and types
        if (stream.match(/^[a-zA-Z_]\w*/)) {
            return 'variable';
        }

        stream.next();
        return null;
    }
});

type NamespaceInfo = {
    name: string;
    relations: { name: string; type: string }[];
    permissions: { name: string; expression: string }[];
};

type SchemaTab = "editor" | "visual" | "systemVisualization";

const SCHEMA_ACTIVE_TAB_STORAGE_KEY = "saffron.schema.active-tab";

const SchemaPage: NextPage = () => {
    const [activeTab, setActiveTab] = useState<SchemaTab>("editor");
    const [schema, setSchema] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [success, setSuccess] = useState<string>("");
    const [namespaces, setNamespaces] = useState<NamespaceInfo[]>([]);

    useEffect(() => {
        const savedTab = window.localStorage.getItem(SCHEMA_ACTIVE_TAB_STORAGE_KEY);
        if (savedTab === "editor" || savedTab === "visual" || savedTab === "systemVisualization") {
            setActiveTab(savedTab);
        }

        loadSchema();
    }, []);

    useEffect(() => {
        parseNamespaces();
    }, [schema]);

    useEffect(() => {
        window.localStorage.setItem(SCHEMA_ACTIVE_TAB_STORAGE_KEY, activeTab);
    }, [activeTab]);

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
        <>

            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="inline-flex items-center gap-2 text-2xl font-bold text-[var(--saffron-text-primary)]">
                            <IconCode className="text-[var(--saffron-warning-strong)]" size={30} aria-hidden />
                            Schema
                        </h2>
                        <p className="text-[var(--saffron-text-muted)]">
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
                <div className="border-b border-[var(--saffron-border-subtle)]">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab("editor")}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "editor"
                                ? "border-[var(--saffron-accent-strong)] text-[var(--saffron-accent-text)]"
                                : "border-transparent text-[var(--saffron-text-muted)] hover:text-[var(--saffron-text-primary)] hover:border-[var(--saffron-border-default)]"
                                }`}
                        >
                            Schema Editor
                        </button>
                        <button
                            onClick={() => setActiveTab("visual")}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "visual"
                                ? "border-[var(--saffron-accent-strong)] text-[var(--saffron-accent-text)]"
                                : "border-transparent text-[var(--saffron-text-muted)] hover:text-[var(--saffron-text-primary)] hover:border-[var(--saffron-border-default)]"
                                }`}
                        >
                            Flat View
                        </button>
                        <button
                            onClick={() => setActiveTab("systemVisualization")}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "systemVisualization"
                                ? "border-[var(--saffron-accent-strong)] text-[var(--saffron-accent-text)]"
                                : "border-transparent text-[var(--saffron-text-muted)] hover:text-[var(--saffron-text-primary)] hover:border-[var(--saffron-border-default)]"
                                }`}
                        >
                            System Visualization
                        </button>
                    </nav>
                </div>

                {success && (
                    <div className="bg-[var(--saffron-success-soft)] border border-[var(--saffron-success-medium)] rounded-lg p-4">
                        <div className="flex items-center">
                            <span className="text-[var(--saffron-success-strong)] mr-2"><IconCircleCheck /></span>
                            <div>
                                <h3 className="text-sm font-medium text-[var(--saffron-success-text-soft)]">Success</h3>
                                <p className="text-sm text-[var(--saffron-success-text)]">{success}</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "editor" && (
                    <div className="bg-[var(--saffron-surface-panel)] shadow rounded-lg border border-[var(--saffron-border-default)] flex flex-col" style={{ height: 'calc(100vh - 320px)' }}>
                        <div className="px-4 py-5 sm:p-6 flex flex-col h-full">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg leading-6 font-medium text-[var(--saffron-text-primary)]">Schema Definition</h3>
                                <div className="flex space-x-3">
                                    <button
                                        onClick={loadSchema}
                                        disabled={isLoading}
                                        className="theme-secondary-button inline-flex items-center justify-center px-3 py-2 shadow-sm text-sm leading-4 font-medium rounded-md focus:outline-none disabled:opacity-50"
                                        style={{ minWidth: '110px' }}
                                    >
                                        <IconReload className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                        {isLoading ? "Loading..." : "Refresh"}
                                    </button>
                                    <button
                                        onClick={saveSchema}
                                        disabled={isLoading}
                                        className="theme-primary-button inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md shadow-sm focus:outline-none disabled:opacity-50"
                                        style={{ minWidth: '145px' }}
                                    ><IconDeviceFloppy className="mr-2" />
                                        {isLoading ? "Saving..." : "Save Schema"}
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 relative rounded-md overflow-hidden border border-[var(--saffron-border-default)]" style={{ minHeight: 0 }}>
                                <CodeMirror
                                    value={schema}
                                    height="calc(100vh - 420px)"
                                    theme={vscodeDark}
                                    extensions={[spicedbMode]}
                                    onChange={(value) => setSchema(value)}
                                    basicSetup={{
                                        lineNumbers: true,
                                        highlightActiveLineGutter: true,
                                        highlightActiveLine: true,
                                        foldGutter: true,
                                    }}
                                    style={{
                                        fontSize: '14px',
                                    }}
                                />
                            </div>

                            <div className="text-sm text-[var(--saffron-text-secondary)] mt-3">
                                <p className="text-xs inline-flex items-center gap-2">
                                    <IconBulb className="text-[var(--saffron-warning-strong)]" /><strong>Tip:</strong> Use the SpiceDB schema language to define your authorization model. Start with{" "}
                                    <code className="bg-[var(--saffron-surface-raised)] px-1 py-0.5 rounded text-[var(--saffron-accent-text)]">definition</code> blocks and define{" "}
                                    <code className="bg-[var(--saffron-surface-raised)] px-1 py-0.5 rounded text-[var(--saffron-success-text)]">relation</code> and{" "}
                                    <code className="bg-[var(--saffron-surface-raised)] px-1 py-0.5 rounded text-[var(--saffron-warning-text-soft)]">permission</code> statements.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "visual" && (
                    <div className="space-y-6">
                        {namespaces.map((ns) => (
                            <div
                                key={ns.name}
                                className="bg-[var(--saffron-surface-panel)] shadow rounded-lg border border-[var(--saffron-border-default)]"
                            >
                                <div className="px-4 py-5 sm:p-6">
                                    <h3 className="text-lg leading-6 font-medium text-[var(--saffron-text-primary)] mb-4">
                                        <span className="inline-flex items-center bg-[var(--saffron-accent-soft)] text-[var(--saffron-accent-text)] px-2 py-1 rounded text-sm font-medium mr-2">
                                            {ns.name}
                                        </span>
                                        Definition
                                    </h3>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="text-md font-medium text-[var(--saffron-text-secondary)] mb-3">Relations</h4>
                                            {ns.relations.length ? (
                                                <div className="space-y-2">
                                                    {ns.relations.map((r, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="flex items-center justify-between p-3 rounded-lg border border-[var(--saffron-border-subtle)] bg-[var(--saffron-surface-raised)]"
                                                        >
                                                            <div>
                                                                <span className="font-medium text-[var(--saffron-text-primary)]">{r.name}</span>
                                                                <span className="text-[var(--saffron-text-secondary)] ml-2">: {r.type}</span>
                                                            </div>
                                                            <span className="text-xs bg-[var(--saffron-accent-soft)] text-[var(--saffron-accent-text)] px-2 py-1 rounded">
                                                                relation
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[var(--saffron-text-muted)] italic">No relations defined</p>
                                            )}
                                        </div>

                                        <div>
                                            <h4 className="text-md font-medium text-[var(--saffron-text-secondary)] mb-3">Permissions</h4>
                                            {ns.permissions.length ? (
                                                <div className="space-y-2">
                                                    {ns.permissions.map((p, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="flex items-center justify-between p-3 rounded-lg border border-[var(--saffron-border-subtle)] bg-[var(--saffron-surface-raised)]"
                                                        >
                                                            <div>
                                                                <span className="font-medium text-[var(--saffron-text-primary)]">{p.name}</span>
                                                                <span className="text-[var(--saffron-text-secondary)] ml-2">= {p.expression}</span>
                                                            </div>
                                                            <span className="text-xs bg-[var(--saffron-accent-soft)] text-[var(--saffron-accent-text)] px-2 py-1 rounded">
                                                                permission
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[var(--saffron-text-muted)] italic">No permissions defined</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {!namespaces.length && (
                            <div className="bg-[var(--saffron-surface-panel)] shadow rounded-lg border border-[var(--saffron-border-default)] p-4">
                                <p className="text-[var(--saffron-text-muted)]">No namespaces parsed yet.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "systemVisualization" && (
                    <div className="bg-white shadow rounded-lg p-4" style={{ height: 'calc(100vh - 320px)' }}>
                        <SchemaGraph schemaText={schema} />
                    </div>
                )}
            </div>
        </>
    );
};

export default SchemaPage;
