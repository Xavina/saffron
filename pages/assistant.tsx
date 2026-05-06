import type { NextPage } from "next";
import type { GetServerSideProps } from "next";
import { useEffect, useRef, useState } from "react";
import { IconArrowUp, IconMessageCircle, IconSparkles } from "@tabler/icons-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { isAssistantEnabled } from "@/lib/assistantFeature";
import Warning from "@/components/Warning";

type Message = {
    id: string;
    role: "assistant" | "user";
    content: string;
};

type AssistantStatus = {
    configured: boolean | null;
    authConfigured: boolean | null;
    model: string;
    message: string;
};

const ASSISTANT_STATUS_ENDPOINT = "/api/spicedb/assistant-status";
const ASSISTANT_STREAM_ENDPOINT = "/api/spicedb/chat-stream";
const ASSISTANT_CONVERSATION_STORAGE_KEY = "saffron.spicedb.assistant.conversationId";

const STARTER_PROMPTS = [
    "explain schema",
    "explain definition tenant",
    "check user:ceo view resource:task1",
    "who-can view task:promserver user",
    "relationships resource:tenant",
];

const DEFAULT_STATUS: AssistantStatus = {
    configured: null,
    authConfigured: null,
    model: "unknown",
    message: "Checking assistant status...",
};

const getString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const getBoolean = (value: unknown) => (typeof value === "boolean" ? value : null);

const normalizeAssistantStatus = (payload: any): AssistantStatus => {
    const configured = getBoolean(payload?.configured) ?? getBoolean(payload?.ready);
    const authConfigured = getBoolean(payload?.authConfigured) ?? getBoolean(payload?.copilotConfigured);
    const model = getString(payload?.activeModel) || getString(payload?.model) || "default";
    const message = getString(payload?.message)
        || (configured === true
            ? "Assistant backend is ready."
            : configured === false
                ? "Assistant backend is not ready."
                : "Assistant status is available.");

    return {
        configured,
        authConfigured,
        model,
        message,
    };
};

const readJsonSafely = async (response: Response) => {
    try {
        return await response.json();
    } catch {
        return null;
    }
};

const getConversationId = (value: unknown) => {
    if (!value || typeof value !== "object") {
        return "";
    }

    return getString((value as Record<string, unknown>).conversationId)
        || getString((value as Record<string, unknown>).sessionId)
        || getString((value as Record<string, unknown>).activeConversationId)
        || getString((value as Record<string, unknown>).activeSessionId);
};

const getConversationIdFromHeaders = (headers: Headers) => (
    getString(headers.get("x-conversation-id"))
    || getString(headers.get("x-session-id"))
);

const buildChatRequestBody = (prompt: string, conversationId: string) => ({
    message: prompt,
    ...(conversationId ? { conversationId, sessionId: conversationId } : {}),
});

const extractStreamDelta = (payload: any) => {
    if (typeof payload === "string") {
        return payload;
    }

    if (!payload || typeof payload !== "object") {
        return "";
    }

    return getString(payload.delta) || getString(payload.content) || getString(payload.reply) || getString(payload.text);
};

const getMarkdownTone = (role: Message["role"]) => ({
    mutedText: role === "assistant" ? "text-gray-600" : "text-blue-100",
    rule: role === "assistant" ? "border-gray-200" : "border-white/20",
    strong: role === "assistant" ? "text-gray-950" : "text-white",
    inlineCode: role === "assistant" ? "bg-gray-100 text-gray-900" : "bg-blue-700/70 text-blue-50",
    codeBlock: role === "assistant"
        ? "border-gray-200 bg-gray-950 text-gray-100"
        : "border-white/20 bg-blue-700/70 text-blue-50",
    tableFrame: role === "assistant" ? "border-gray-200" : "border-white/20",
    tableHead: role === "assistant" ? "bg-gray-50 text-gray-700" : "bg-blue-700/50 text-blue-50",
    tableCell: role === "assistant" ? "border-gray-200" : "border-white/15",
    blockquote: role === "assistant" ? "border-gray-300 text-gray-600" : "border-white/40 text-blue-50",
});

const getMarkdownComponents = (role: Message["role"]): Components => ({
    h1: ({ children }) => <h1 className={`mt-5 text-xl font-semibold tracking-tight first:mt-0 ${getMarkdownTone(role).strong}`}>{children}</h1>,
    h2: ({ children }) => <h2 className={`mt-5 text-lg font-semibold tracking-tight first:mt-0 ${getMarkdownTone(role).strong}`}>{children}</h2>,
    h3: ({ children }) => <h3 className={`mt-4 text-base font-semibold first:mt-0 ${getMarkdownTone(role).strong}`}>{children}</h3>,
    p: ({ children }) => <p className="mt-3 leading-7 first:mt-0">{children}</p>,
    hr: () => <hr className={`my-4 border-0 border-t ${getMarkdownTone(role).rule}`} />,
    ul: ({ children }) => <ul className="mt-3 list-disc space-y-1.5 pl-5 first:mt-0">{children}</ul>,
    ol: ({ children }) => <ol className="mt-3 list-decimal space-y-1.5 pl-5 first:mt-0">{children}</ol>,
    li: ({ children }) => <li>{children}</li>,
    a: ({ children, ...props }) => <a className="font-medium underline underline-offset-2" {...props}>{children}</a>,
    strong: ({ children }) => <strong className={`font-semibold ${getMarkdownTone(role).strong}`}>{children}</strong>,
    em: ({ children }) => <em className={`italic ${getMarkdownTone(role).mutedText}`}>{children}</em>,
    br: () => <br className="block leading-3" />,
    blockquote: ({ children }) => (
        <blockquote className={`mt-3 border-l-2 pl-4 italic first:mt-0 ${getMarkdownTone(role).blockquote}`}>
            {children}
        </blockquote>
    ),
    table: ({ children }) => (
        <div className={`mt-4 overflow-x-auto rounded-xl border first:mt-0 ${getMarkdownTone(role).tableFrame}`}>
            <table className="min-w-full border-collapse text-left text-sm leading-6">{children}</table>
        </div>
    ),
    thead: ({ children }) => <thead className={getMarkdownTone(role).tableHead}>{children}</thead>,
    tbody: ({ children }) => <tbody className={role === "assistant" ? "bg-white" : "bg-transparent"}>{children}</tbody>,
    tr: ({ children }) => <tr className={`align-top ${getMarkdownTone(role).tableCell}`}>{children}</tr>,
    th: ({ children }) => (
        <th className={`border-b px-3 py-2 font-semibold ${getMarkdownTone(role).tableCell} ${getMarkdownTone(role).strong}`}>
            {children}
        </th>
    ),
    td: ({ children }) => <td className={`border-t px-3 py-2 ${getMarkdownTone(role).tableCell}`}>{children}</td>,
    pre: ({ children }) => (
        <pre className={`mt-3 overflow-x-auto rounded-xl border px-4 py-3 text-sm first:mt-0 ${getMarkdownTone(role).codeBlock}`}>
            {children}
        </pre>
    ),
    code: (props) => {
        const { children, className, ...rest } = props;
        const inline = "inline" in props ? Boolean(props.inline) : false;

        if (inline) {
            return (
                <code
                    className={`rounded px-1.5 py-0.5 text-[0.95em] ${getMarkdownTone(role).inlineCode}`}
                    {...rest}
                >
                    {children}
                </code>
            );
        }

        return (
            <code className={`${className || ""} block whitespace-pre-wrap break-words font-mono text-sm leading-6`} {...rest}>
                {children}
            </code>
        );
    },
});

const MessageContent = ({ content, role }: { content: string; role: Message["role"] }) => (
    <div className="text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={getMarkdownComponents(role)}>
            {content}
        </ReactMarkdown>
    </div>
);

const AssistantPage: NextPage = () => {
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [assistantStatus, setAssistantStatus] = useState<AssistantStatus>(DEFAULT_STATUS);
    const [conversationId, setConversationId] = useState("");
    const messageCounterRef = useRef(0);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: [
                "Ask about the active SpiceDB model or run one of the supported operations.",
                "Examples:",
                ...STARTER_PROMPTS.map((prompt) => `- ${prompt}`),
            ].join("\n"),
        },
    ]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const storedConversationId = window.localStorage.getItem(ASSISTANT_CONVERSATION_STORAGE_KEY);

        if (storedConversationId) {
            setConversationId(storedConversationId);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        const loadStatus = async () => {
            try {
                const response = await fetch(ASSISTANT_STATUS_ENDPOINT);

                if (!isMounted) {
                    return;
                }

                if (!response.ok) {
                    if (response.status === 404 || response.status === 405) {
                        setAssistantStatus({
                            configured: null,
                            authConfigured: null,
                            model: "unknown",
                            message: "Assistant status endpoint is unavailable.",
                        });
                        return;
                    }

                    const data = await readJsonSafely(response);
                    throw new Error(data?.message || "Failed to load assistant status.");
                }

                const data = await response.json();

                if (isMounted) {
                    setAssistantStatus(normalizeAssistantStatus(data));
                }
            } catch (statusError: any) {
                if (isMounted) {
                    setAssistantStatus({
                        configured: null,
                        authConfigured: null,
                        model: "unknown",
                        message: statusError?.message || "Failed to load assistant status.",
                    });
                }
            }
        };

        loadStatus();

        return () => {
            isMounted = false;
        };
    }, []);

    const nextMessageId = () => {
        messageCounterRef.current += 1;
        return `message-${messageCounterRef.current}`;
    };

    const rememberConversationId = (nextConversationId: string) => {
        const normalizedConversationId = nextConversationId.trim();

        if (!normalizedConversationId) {
            return;
        }

        setConversationId((currentConversationId) => {
            if (currentConversationId === normalizedConversationId) {
                return currentConversationId;
            }

            return normalizedConversationId;
        });

        if (typeof window !== "undefined") {
            window.localStorage.setItem(ASSISTANT_CONVERSATION_STORAGE_KEY, normalizedConversationId);
        }
    };

    const replaceAssistantMessage = (messageId: string, content: string) => {
        setMessages((currentMessages) => currentMessages.map((message) => (
            message.id === messageId
                ? { ...message, content }
                : message
        )));
    };

    const appendAssistantMessage = (messageId: string, contentChunk: string) => {
        if (!contentChunk) {
            return;
        }

        setMessages((currentMessages) => currentMessages.map((message) => (
            message.id === messageId
                ? { ...message, content: `${message.content}${contentChunk}` }
                : message
        )));
    };

    const removeMessage = (messageId: string) => {
        setMessages((currentMessages) => currentMessages.filter((message) => message.id !== messageId));
    };

    const handleStarterPromptClick = (prompt: string) => {
        setInput(prompt);
        textareaRef.current?.focus();
    };

    const streamAssistantReply = async (prompt: string, assistantMessageId: string, activeConversationId: string) => {
        const response = await fetch(ASSISTANT_STREAM_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildChatRequestBody(prompt, activeConversationId)),
        });

        if (response.status === 404 || response.status === 405 || response.status === 501) {
            return false;
        }

        if (!response.ok) {
            const data = await readJsonSafely(response);
            throw new Error(data?.message || "Assistant streaming request failed");
        }

        if (!response.body) {
            return false;
        }

        rememberConversationId(getConversationIdFromHeaders(response.headers));

        const contentType = response.headers.get("content-type") || "";
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";

        const pushChunk = (chunk: string) => {
            if (!chunk) {
                return;
            }

            fullContent += chunk;
            appendAssistantMessage(assistantMessageId, chunk);
        };

        if (contentType.includes("text/event-stream")) {
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const events = buffer.split("\n\n");
                buffer = events.pop() || "";

                for (const event of events) {
                    const dataLines = event
                        .split("\n")
                        .filter((line) => line.startsWith("data:"))
                        .map((line) => line.slice(5).trim());

                    if (!dataLines.length) {
                        continue;
                    }

                    const payloadText = dataLines.join("\n");
                    if (payloadText === "[DONE]") {
                        continue;
                    }

                    try {
                        const payload = JSON.parse(payloadText);
                        rememberConversationId(getConversationId(payload));
                        pushChunk(extractStreamDelta(payload));
                    } catch {
                        pushChunk(payloadText);
                    }
                }
            }

            return fullContent;
        }

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            pushChunk(decoder.decode(value, { stream: true }));
        }

        pushChunk(decoder.decode());
        return fullContent;
    };

    const sendMessage = async (promptOverride?: string) => {
        const prompt = (promptOverride ?? input).trim();
        if (!prompt || isLoading) {
            return;
        }

        const userMessage: Message = { id: nextMessageId(), role: "user", content: prompt };
        const assistantMessageId = nextMessageId();
        setMessages((currentMessages) => [...currentMessages, userMessage, { id: assistantMessageId, role: "assistant", content: "" }]);
        setInput("");
        setError("");
        setIsLoading(true);

        try {
            const streamed = await streamAssistantReply(prompt, assistantMessageId, conversationId);

            if (typeof streamed === "string") {
                replaceAssistantMessage(assistantMessageId, streamed.trim() || "No response generated.");
                return;
            }

            const response = await fetch("/api/spicedb/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildChatRequestBody(prompt, conversationId)),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Assistant request failed");
            }

            rememberConversationId(getConversationId(data) || getConversationIdFromHeaders(response.headers));

            replaceAssistantMessage(assistantMessageId, data.reply || "No response generated.");
        } catch (err: any) {
            removeMessage(assistantMessageId);
            setError(err.message || "Failed to contact the assistant");
        } finally {
            setIsLoading(false);
        }
    };

    const statusTone = assistantStatus.configured === true
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : assistantStatus.configured === false || assistantStatus.authConfigured === false
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-gray-200 bg-gray-50 text-gray-700";

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="inline-flex items-center gap-2 text-2xl font-bold text-gray-900">
                        <IconMessageCircle className="text-orange-300" size={30} aria-hidden />
                        Assistant
                    </h2>
                    <p className="text-gray-400">
                        A task-oriented chat surface for explaining the schema and running direct authorization queries.
                    </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    First slice: deterministic intent routing over existing SpiceDB APIs.
                </div>
            </div>

            <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${statusTone}`}>
                <div>
                    <div className="font-semibold">Assistant status</div>
                    <div>{assistantStatus.message}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
                    <span className="rounded-full bg-white/80 px-3 py-1">
                        Copilot auth {assistantStatus.authConfigured === true ? "configured" : assistantStatus.authConfigured === false ? "missing" : "unknown"}
                    </span>
                    <span className="rounded-full bg-white/80 px-3 py-1">
                        Model {assistantStatus.model}
                    </span>
                </div>
            </div>

            {error && <Warning title="Assistant Problem" error={error} />}

            <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                        <IconSparkles size={16} />
                        Starter Prompts
                    </div>
                    <div className="space-y-3">
                        {STARTER_PROMPTS.map((prompt) => (
                            <button
                                key={prompt}
                                onClick={() => handleStarterPromptClick(prompt)}
                                disabled={isLoading}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm text-gray-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                    <div className="mt-5 rounded-xl bg-gray-900 p-4 text-sm text-gray-100">
                        <p className="font-semibold text-white">Supported intents</p>
                        <p className="mt-2">`explain schema` summarizes definitions.</p>
                        <p>{"`explain definition <name>` drills into one object type."}</p>
                        <p>{"`check <subject> <permission> <resource>` runs a permission check."}</p>
                        <p>{"`who-can <permission> <resource> <subjectType>` lists matching subjects."}</p>
                        <p>{"`relationships <type:id>` samples stored relationships."}</p>
                    </div>
                </section>

                <section className="flex h-[min(70vh,720px)] min-h-[540px] min-w-0 min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-200 px-6 py-4">
                        <h3 className="text-lg font-semibold text-gray-900">Conversation</h3>
                        <p className="text-sm text-gray-500">
                            The assistant routes your prompt to schema inspection or the matching SpiceDB operation.
                        </p>
                    </div>

                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[linear-gradient(180deg,#fff_0%,#f8fafc_100%)] px-6 py-6">
                        {messages.map((message, index) => (
                            <div
                                key={message.id || `${message.role}-${index}`}
                                className={`max-w-3xl rounded-2xl px-5 py-4 shadow-sm ${message.role === "assistant"
                                    ? "border border-gray-200 bg-white text-gray-800"
                                    : "ml-auto bg-blue-600 text-white"
                                    }`}
                            >
                                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
                                    {message.role === "assistant" ? "Assistant" : "You"}
                                </div>
                                <MessageContent
                                    role={message.role}
                                    content={message.content || (isLoading && message.role === "assistant" ? "Working through the request..." : "")}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-gray-200 bg-white px-6 py-4">
                        <div className="flex items-end gap-3">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(event) => setInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        sendMessage();
                                    }
                                }}
                                placeholder="Ask about the schema or run a permission query..."
                                className="min-h-[96px] flex-1 resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            />
                            <button
                                onClick={() => sendMessage()}
                                disabled={isLoading || !input.trim()}
                                className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                                aria-label="Send message"
                            >
                                <IconArrowUp size={20} />
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AssistantPage;

export const getServerSideProps: GetServerSideProps = async () => {
    if (!isAssistantEnabled()) {
        return { notFound: true };
    }

    return { props: {} };
};