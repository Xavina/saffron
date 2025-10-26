// pages/terminal.tsx
import type { NextPage } from "next";
import { useCallback, useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import {
    IconPlayerPlayFilled,
    IconTrash,
    IconArrowsMoveVertical,
    IconTerminal2,
    IconCopy,
    IconBulb,
    IconDots,
} from "@tabler/icons-react";

type TerminalResponse = {
    ok: boolean;
    code: number | null;
    stdout: string;
    stderr: string;
    startedAt?: string;
    endedAt?: string;
    durationMs?: number;
    error?: string;
};

const HANDLE_HEIGHT = 5;

const TerminalPage: NextPage = () => {
    const containerRef = useRef<HTMLDivElement | null>(null);

    // 65% top to start; we store fraction (0..1) and compute px from container height.
    const [topFrac, setTopFrac] = useState(0.65);
    const [containerH, setContainerH] = useState(0);
    const [dragging, setDragging] = useState(false);

    const [command, setCommand] = useState<string>("zed schema read");
    const [result, setResult] = useState<TerminalResponse | null>(null);
    const [isRunning, setIsRunning] = useState(false);

    const updateContainerH = useCallback(() => {
        if (containerRef.current) setContainerH(containerRef.current.clientHeight);
    }, []);

    useEffect(() => {
        updateContainerH();
        window.addEventListener("resize", updateContainerH);
        return () => window.removeEventListener("resize", updateContainerH);
    }, [updateContainerH]);

    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setDragging(true);
    };

    const onMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!dragging || !containerRef.current) return;
            const bounds = containerRef.current.getBoundingClientRect();
            const y = e.clientY - bounds.top;
            const maxTop = Math.max(0, bounds.height - HANDLE_HEIGHT);
            const clampedY = Math.min(Math.max(0, y), maxTop);
            setTopFrac(bounds.height === 0 ? 0.65 : clampedY / bounds.height);
        },
        [dragging]
    );

    const onMouseUp = useCallback(() => setDragging(false), []);

    useEffect(() => {
        if (!dragging) return;
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [dragging, onMouseMove, onMouseUp]);

    const runCommand = async () => {
        if (!command.trim()) return;
        setIsRunning(true);
        setResult(null);
        try {
            const res = await fetch("/api/spicedb/terminal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ command }),
            });
            const data: TerminalResponse = await res.json();
            setResult(data);
        } catch (err: any) {
            setResult({
                ok: false,
                code: null,
                stdout: "",
                stderr: "",
                error: err?.message || "Request failed",
            });
        } finally {
            setIsRunning(false);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            runCommand();
        }
    };

    const outputText =
        (result?.stdout || "") +
        (result?.stderr ? `\n\n[stderr]\n${result.stderr}` : "") +
        (result?.error ? `\n\n[error]\n${result.error}` : "");

    const copyOut = async () => {
        try {
            await navigator.clipboard.writeText(outputText || "");
        } catch { }
    };

    // Compute pixel heights from fraction and container height.
    const topPx = Math.max(
        0,
        Math.min(containerH - HANDLE_HEIGHT, Math.round(containerH * topFrac))
    );
    const bottomTopPx = topPx + HANDLE_HEIGHT;

    return (
        <>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="inline-flex items-center gap-2 text-2xl font-bold text-gray-900">
                            <IconTerminal2 className="text-orange-300" size={30} aria-hidden />
                            Terminal
                        </h2>
                        <p className="text-gray-400">Execute zed queries against your database.</p>
                    </div>
                </div>

                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Terminal Commands</h3>
                    <div className="flex space-x-3">
                        <button
                            onClick={() => setResult(null)}
                            className="inline-flex items-center justify-center px-3 py-2 border border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-600 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            <IconTrash size={16} />&nbsp;
                            Clear
                        </button>
                        <button
                            onClick={copyOut}
                            className="inline-flex items-center justify-center px-3 py-2 border border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-600 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            title="Copy output"
                        >
                            <IconCopy size={16} />&nbsp;
                            Copy
                        </button>
                        <button
                            onClick={runCommand}
                            disabled={isRunning}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            <IconPlayerPlayFilled className="mr-2" />
                            {isRunning ? "Running…" : "Run (Ctrl/⌘ + Enter)"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Split container */}
            <div
                ref={containerRef}
                className="relative w-full rounded-lg overflow-hidden border border-gray-200 bg-white"
                style={{ height: "70vh" }} // adjust if you want; independent of header above
            >
                {/* Top pane (input) */}
                <div
                    className="absolute inset-x-0 top-0"
                    style={{ height: `${topPx}px` }}
                >
                    <textarea
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder='Type a "zed" command, e.g. zed schema read'
                        className="w-full h-full p-4 bg-gray-50 border-b border-gray-200 font-mono text-sm focus:ring-0 focus:outline-none resize-none"
                        style={{ fontFamily: 'Monaco, Consolas, "Courier New", monospace' }}
                        spellCheck={false}
                    />
                </div>

                {/* Splitter handle (5px) */}
                <div
                    onMouseDown={onMouseDown}
                    className="absolute left-0 right-0"
                    style={{ top: `${topPx}px`, height: `${HANDLE_HEIGHT}px` }}
                >
                    <div className="h-full w-full cursor-row-resize bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                        <IconDots size={24} className="text-white-900" />
                    </div>
                </div>

                {/* Bottom pane (output) */}
                <div
                    className="absolute left-0 right-0 bottom-0 overflow-none"
                    style={{ top: `${bottomTopPx}px` }}
                >
                    <textarea
                        readOnly
                        value={outputText}
                        className="w-full h-full p-4 bg-gray-50 font-mono text-sm focus:ring-0 focus:outline-none resize-none"
                        style={{ fontFamily: 'Monaco, Consolas, "Courier New", monospace' }}
                        spellCheck={false}
                    />
                </div>
            </div>

            <p className="text-xs text-gray-500 inline-flex items-center gap-2 mt-2">
                <IconBulb className="text-yellow-600" />
                <strong>Tip:</strong> Run with Ctrl/⌘ + Enter. The API expects a command beginning with <code>zed</code>.
            </p>
        </>
    );
};

export default TerminalPage;
