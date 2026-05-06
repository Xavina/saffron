import { CopilotClient, defineTool } from '@github/copilot-sdk';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { v1 } from '@authzed/authzed-node';
import {
    getSpiceDbPromiseClient,
    mapGrpcError,
    toObjectReference,
    toSubjectReference,
} from '../spicedb';
import { callAuthZedMcpTool } from './authzedMcpClient';

const RELATIONSHIP_SAMPLE_LIMIT = 10;
const CONFIGURED_MODEL = process.env.COPILOT_MODEL || process.env.GITHUB_COPILOT_MODEL || '';
const DEFAULT_ASSISTANT_RESPONSE_TIMEOUT_MS = 60000;
const ASSISTANT_STATUS_TIMEOUT_MS = 10000;
const ASSISTANT_SYSTEM_PROMPT_PATH = path.join(process.cwd(), 'lib', 'copilot', 'prompts', 'assistant-system-prompt.md');
const DEFAULT_ASSISTANT_SYSTEM_PROMPT = [
    'You are the SpiceDB assistant for this application.',
    'Use the provided SpiceDB custom tools for questions about the active SpiceDB schema and the data stored in SpiceDB.',
    'Use the AuthZed documentation tools for broader SpiceDB questions about concepts, schema design, API usage, best practices, and example schemas.',
    'Do not rely on filesystem, shell, network, or other built-in tools for these requests.',
    'Use the schema tools to explain definitions, relations, and permissions.',
    'Use the data tools to inspect stored relationships, run permission checks, and look up matching subjects.',
    'Use the AuthZed tools when the user asks for official documentation, API reference details, best practices, troubleshooting guidance, or example schema patterns.',
    'When answering, ground the response in tool results. Do not invent schema definitions, permissions, relationships, or object ids.',
    'If the user asks for data that requires identifiers or parameters that were not provided, ask for the missing values in the format expected by the tools.',
    'If a request is outside the available SpiceDB capabilities, say so clearly and suggest the supported operations.',
    'Keep answers concise and operational.',
].join('\n');

let copilotClientPromise = null;
let lastObservedModel = '';
let assistantSystemPromptPromise = null;

export class AssistantApiError extends Error {
    constructor(message, statusCode = 500, options = {}) {
        super(message);
        this.name = 'AssistantApiError';
        this.statusCode = statusCode;
        this.details = options.details;
        this.code = options.code;
    }
}

export async function handleSpiceDbAssistantMessage(message, options = {}) {
    const prompt = typeof message === 'string' ? message.trim() : '';
    const requestedSessionId = normalizeSessionIdentifier(options.sessionId || options.conversationId);

    if (!prompt) {
        throw new AssistantApiError('A chat message is required.', 400);
    }

    const client = await getCopilotClient();
    let session;
    let activeSessionId = requestedSessionId;

    try {
        const resolvedSession = await getOrCreateAssistantSession(client, {
            requestedSessionId,
        });

        session = resolvedSession.session;
        activeSessionId = resolvedSession.sessionId;

        const responseEvent = await session.sendAndWait({ prompt }, DEFAULT_ASSISTANT_RESPONSE_TIMEOUT_MS);
        const reply = responseEvent?.data?.content?.trim();

        await rememberSessionModel(session);

        if (!reply) {
            throw new AssistantApiError('Copilot did not return a response for this request.', 502);
        }

        return {
            reply,
            sessionId: activeSessionId,
            conversationId: activeSessionId,
        };
    } catch (error) {
        throw normalizeAssistantError(error);
    } finally {
        if (session) {
            await session.disconnect().catch(() => undefined);
        }
    }
}

export async function streamSpiceDbAssistantMessage(message, options = {}, handlers = {}) {
    const prompt = typeof message === 'string' ? message.trim() : '';
    const requestedSessionId = normalizeSessionIdentifier(options.sessionId || options.conversationId);

    if (!prompt) {
        throw new AssistantApiError('A chat message is required.', 400);
    }

    const client = await getCopilotClient();
    let session;
    let reply = '';
    let streamedContent = '';
    let runtimeError = null;
    let activeSessionId = requestedSessionId;

    try {
        const resolvedSession = await getOrCreateAssistantSession(client, {
            requestedSessionId,
            streaming: true,
        });

        session = resolvedSession.session;
        activeSessionId = resolvedSession.sessionId;

        handlers.onReady?.({
            activeModel: lastObservedModel || getConfiguredModel() || null,
            sessionId: activeSessionId,
            conversationId: activeSessionId,
        });

        session.on('assistant.message_delta', (event) => {
            const delta = event?.data?.deltaContent || '';

            if (!delta) {
                return;
            }

            streamedContent += delta;
            handlers.onDelta?.(delta);
        });

        session.on('assistant.message', (event) => {
            reply = event?.data?.content?.trim() || reply;
        });

        session.on('session.error', (event) => {
            runtimeError = new AssistantApiError(
                event?.data?.message || 'Assistant streaming failed.',
                event?.data?.statusCode || 502,
                { details: event?.data?.message, code: event?.data?.errorType },
            );
        });

        await session.sendAndWait({ prompt }, DEFAULT_ASSISTANT_RESPONSE_TIMEOUT_MS);
        await rememberSessionModel(session);

        if (runtimeError && !reply && !streamedContent) {
            throw runtimeError;
        }

        const finalReply = reply || streamedContent.trim();

        if (!finalReply) {
            throw runtimeError || new AssistantApiError('Copilot did not return a response for this request.', 502);
        }

        if (!streamedContent && finalReply) {
            handlers.onDelta?.(finalReply);
        }

        handlers.onDone?.({
            reply: finalReply,
            activeModel: lastObservedModel || getConfiguredModel() || null,
            sessionId: activeSessionId,
            conversationId: activeSessionId,
        });

        return {
            reply: finalReply,
            activeModel: lastObservedModel || getConfiguredModel() || null,
            sessionId: activeSessionId,
            conversationId: activeSessionId,
        };
    } catch (error) {
        throw normalizeAssistantError(error);
    } finally {
        if (session) {
            await session.disconnect().catch(() => undefined);
        }
    }
}

export async function getSpiceDbAssistantStatus() {
    const status = {
        ready: false,
        configured: false,
        authConfigured: null,
        runtimeConfigured: null,
        configuredModel: getConfiguredModel() || null,
        activeModel: lastObservedModel || getConfiguredModel() || null,
        message: 'GitHub Copilot assistant is not configured for this server.',
    };

    let session;

    try {
        const client = await withTimeout(
            getCopilotClient(),
            ASSISTANT_STATUS_TIMEOUT_MS,
            'GitHub Copilot assistant status check timed out while starting the runtime.',
        );

        status.runtimeConfigured = true;

        session = await withTimeout(
            createAssistantSession(client),
            ASSISTANT_STATUS_TIMEOUT_MS,
            'GitHub Copilot assistant status check timed out while opening a session.',
        );

        status.authConfigured = true;
        status.ready = true;
        status.configured = true;

        const selectedModel = await rememberSessionModel(session);
        status.activeModel = selectedModel || status.activeModel;
        status.message = status.activeModel
            ? `GitHub Copilot assistant is ready using ${status.activeModel}.`
            : 'GitHub Copilot assistant is ready using the host default model.';

        return status;
    } catch (error) {
        const normalized = normalizeAssistantError(error);
        const classification = classifyAssistantFailure(normalized);

        return {
            ...status,
            authConfigured: classification.authConfigured,
            runtimeConfigured: classification.runtimeConfigured,
            message: normalized.message,
            error: normalized.details || normalized.message,
            code: normalized.code,
        };
    } finally {
        if (session) {
            await session.disconnect().catch(() => undefined);
        }
    }
}

async function getCopilotClient() {
    if (!copilotClientPromise) {
        copilotClientPromise = startCopilotClient().catch((error) => {
            copilotClientPromise = null;
            throw error;
        });
    }

    return copilotClientPromise;
}

async function startCopilotClient() {
    const token = process.env.COPILOT_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const client = new CopilotClient(token ? { gitHubToken: token, useLoggedInUser: false } : {});

    try {
        await client.start();
        return client;
    } catch (error) {
        throw normalizeAssistantError(error);
    }
}

function getConfiguredModel() {
    return CONFIGURED_MODEL || '';
}

async function createAssistantSession(client, options = {}) {
    return client.createSession(await createAssistantSessionConfig(options));
}

async function resumeAssistantSession(client, sessionId, options = {}) {
    return client.resumeSession(sessionId, await createAssistantSessionConfig(options));
}

async function createAssistantSessionConfig(options = {}) {
    return {
        ...(getConfiguredModel() ? { model: getConfiguredModel() } : {}),
        ...(options.streaming ? { streaming: true } : {}),
        onPermissionRequest: approveCustomToolOnly,
        tools: createSpiceDbTools(),
        systemMessage: {
            content: await getAssistantSystemPrompt(),
        },
    };
}

async function getOrCreateAssistantSession(client, options = {}) {
    const requestedSessionId = normalizeSessionIdentifier(options.requestedSessionId);

    if (requestedSessionId) {
        try {
            const session = await resumeAssistantSession(client, requestedSessionId, options);

            return {
                session,
                sessionId: session.sessionId || requestedSessionId,
                reused: true,
            };
        } catch (error) {
            if (!isMissingAssistantSessionError(error)) {
                throw error;
            }
        }
    }

    const session = await createAssistantSession(client, options);

    return {
        session,
        sessionId: session.sessionId,
        reused: false,
    };
}

function normalizeSessionIdentifier(value) {
    return typeof value === 'string' ? value.trim() : '';
}

async function getAssistantSystemPrompt() {
    if (!assistantSystemPromptPromise) {
        assistantSystemPromptPromise = readFile(ASSISTANT_SYSTEM_PROMPT_PATH, 'utf8')
            .then((content) => content.trim() || DEFAULT_ASSISTANT_SYSTEM_PROMPT)
            .catch(() => DEFAULT_ASSISTANT_SYSTEM_PROMPT);
    }

    return assistantSystemPromptPromise;
}

function isMissingAssistantSessionError(error) {
    const message = error?.message || '';

    return message.includes('Session not found:') || message.includes('Unknown session ');
}

async function rememberSessionModel(session) {
    try {
        const events = await session.getMessages();
        const startEvent = events.find((event) => event?.type === 'session.start');
        const selectedModel = startEvent?.data?.selectedModel || '';

        if (selectedModel) {
            lastObservedModel = selectedModel;
        }

        return selectedModel;
    } catch {
        return lastObservedModel;
    }
}

function classifyAssistantFailure(error) {
    const message = error?.message || '';

    if (message.startsWith('GitHub Copilot SDK is not configured')) {
        return { authConfigured: false, runtimeConfigured: true };
    }

    if (message.startsWith('GitHub Copilot SDK model configuration is invalid')) {
        return { authConfigured: true, runtimeConfigured: true };
    }

    if (message.startsWith('GitHub Copilot SDK could not start its CLI runtime')) {
        return { authConfigured: null, runtimeConfigured: false };
    }

    return { authConfigured: null, runtimeConfigured: null };
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new AssistantApiError(timeoutMessage, 503));
        }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
}

function approveCustomToolOnly(request) {
    if (request.kind === 'custom-tool') {
        return { kind: 'approved' };
    }

    return { kind: 'denied-by-rules' };
}

function createSpiceDbTools() {
    return [
        defineTool('schema_summary', {
            description: 'Read the active SpiceDB schema and summarize object definitions, relations, and permissions.',
            skipPermission: true,
            parameters: z.object({}),
            handler: async () => withSpiceDbErrorMapping(() => explainSchema(getSpiceDbPromiseClient())),
        }),
        defineTool('explain_definition', {
            description: 'Explain one SpiceDB definition, including its relations and permissions.',
            skipPermission: true,
            parameters: z.object({
                definitionName: z.string().min(1).describe('The SpiceDB definition name, such as resource or user.'),
            }),
            handler: async ({ definitionName }) => withSpiceDbErrorMapping(() => explainDefinition(getSpiceDbPromiseClient(), definitionName)),
        }),
        defineTool('permission_check', {
            description: 'Run a SpiceDB permission check for one subject, permission, and resource.',
            skipPermission: true,
            parameters: z.object({
                subjectToken: z.string().min(3).describe('Subject in type:id or type:id#relation form.'),
                permission: z.string().min(1).describe('Permission name to check.'),
                resourceToken: z.string().min(3).describe('Resource in type:id form.'),
            }),
            handler: async ({ subjectToken, permission, resourceToken }) => withSpiceDbErrorMapping(() => runPermissionCheck(getSpiceDbPromiseClient(), {
                subjectToken,
                permission,
                resourceToken,
            })),
        }),
        defineTool('lookup_subjects', {
            description: 'Find subjects of a given type that resolve a permission on a resource.',
            skipPermission: true,
            parameters: z.object({
                permission: z.string().min(1).describe('Permission name to resolve.'),
                resourceToken: z.string().min(3).describe('Resource in type:id form.'),
                subjectType: z.string().min(1).describe('Subject object type, such as user or group.'),
            }),
            handler: async ({ permission, resourceToken, subjectType }) => withSpiceDbErrorMapping(() => lookupSubjects(getSpiceDbPromiseClient(), {
                permission,
                resourceToken,
                subjectType,
            })),
        }),
        defineTool('relationships_summary', {
            description: 'Summarize up to ten stored relationships for a specific object or object type.',
            skipPermission: true,
            parameters: z.object({
                token: z.string().min(1).describe('Object selector in type or type:id form.'),
            }),
            handler: async ({ token }) => withSpiceDbErrorMapping(() => summarizeRelationships(getSpiceDbPromiseClient(), token)),
        }),
        defineTool('authzed_search_docs', {
            description: 'Search official AuthZed and SpiceDB documentation for concepts, best practices, and troubleshooting guidance.',
            skipPermission: true,
            parameters: z.object({
                query: z.string().min(2).describe('Natural language search query for docs content.'),
                limit: z.number().int().min(1).max(10).optional().describe('Maximum number of matching documentation pages to return.'),
            }),
            handler: async ({ query, limit }) => withAuthZedMcpErrorMapping(() => searchAuthZedDocs(query, limit)),
        }),
        defineTool('authzed_search_api', {
            description: 'Search official SpiceDB and AuthZed API methods or message types for request and response details.',
            skipPermission: true,
            parameters: z.object({
                query: z.string().min(2).describe('Natural language search query for API methods or messages.'),
                type: z.enum(['all', 'methods', 'messages']).optional().describe('Restrict the search to methods, messages, or both.'),
                limit: z.number().int().min(1).max(10).optional().describe('Maximum number of API search results to return.'),
            }),
            handler: async ({ query, type, limit }) => withAuthZedMcpErrorMapping(() => searchAuthZedApi(query, type, limit)),
        }),
        defineTool('authzed_search_examples', {
            description: 'Search official SpiceDB example schemas for common authorization patterns such as RBAC, caveats, and document sharing.',
            skipPermission: true,
            parameters: z.object({
                query: z.string().min(2).describe('Authorization pattern or schema example to search for.'),
                limit: z.number().int().min(1).max(10).optional().describe('Maximum number of example schemas to return.'),
            }),
            handler: async ({ query, limit }) => withAuthZedMcpErrorMapping(() => searchAuthZedExamples(query, limit)),
        }),
    ];
}

async function withSpiceDbErrorMapping(work) {
    try {
        return await work();
    } catch (error) {
        const mapped = mapGrpcError(error);
        throw new AssistantApiError(mapped.message, 502, { details: mapped.message, code: mapped.code });
    }
}

async function withAuthZedMcpErrorMapping(work) {
    try {
        const result = await work();

        if (result?.isError) {
            throw new AssistantApiError(result.summary, 502, { details: result.summary, code: 'AUTHZED_MCP_TOOL_ERROR' });
        }

        return result;
    } catch (error) {
        if (error instanceof AssistantApiError) {
            throw error;
        }

        throw new AssistantApiError(
            `AuthZed MCP request failed: ${error?.message || 'Unknown error.'}`,
            502,
            { details: error?.message || 'Unknown error.', code: error?.code || 'AUTHZED_MCP_ERROR' },
        );
    }
}

function normalizeAssistantError(error) {
    if (error instanceof AssistantApiError) {
        return error;
    }

    const message = error?.message || error?.details || 'Assistant request failed.';
    const lowerMessage = message.toLowerCase();

    if (
        lowerMessage.includes('authentication')
        || lowerMessage.includes('not authenticated')
        || lowerMessage.includes('login')
        || lowerMessage.includes('token')
        || lowerMessage.includes('copilot subscription')
        || lowerMessage.includes('401')
        || lowerMessage.includes('403')
    ) {
        return new AssistantApiError(
            'GitHub Copilot SDK is not configured for this server. Sign in with Copilot CLI, set GITHUB_TOKEN or COPILOT_GITHUB_TOKEN, or configure a supported BYOK provider.',
            503,
            { details: message, code: error?.code },
        );
    }

    if (lowerMessage.includes('model') && (lowerMessage.includes('not available') || lowerMessage.includes('unknown'))) {
        return new AssistantApiError(
            'GitHub Copilot SDK model configuration is invalid for this server. Set COPILOT_MODEL to an available model or rely on the host default model.',
            503,
            { details: message, code: error?.code },
        );
    }

    if (lowerMessage.includes('cli') && (lowerMessage.includes('not found') || lowerMessage.includes('spawn'))) {
        return new AssistantApiError(
            'GitHub Copilot SDK could not start its CLI runtime in this environment.',
            503,
            { details: message, code: error?.code },
        );
    }

    return new AssistantApiError(message, 500, { details: message, code: error?.code });
}

async function explainSchema(client) {
    const schema = await getParsedSchema(client);

    if (!schema.namespaces.length) {
        return {
            summary: 'No schema definitions are available yet.',
            namespaces: [],
        };
    }

    const summary = schema.namespaces
        .map((namespace) => {
            const relationNames = namespace.relations.map((relation) => relation.name).join(', ') || 'none';
            const permissionNames = namespace.permissions.map((permission) => permission.name).join(', ') || 'none';
            return `${namespace.name}: relations [${relationNames}], permissions [${permissionNames}]`;
        })
        .join('\n');

    return {
        summary: [
            `The schema currently defines ${schema.namespaces.length} object type${schema.namespaces.length === 1 ? '' : 's'}.`,
            summary,
        ].join('\n'),
        namespaces: schema.namespaces,
    };
}

async function explainDefinition(client, definitionName) {
    const schema = await getParsedSchema(client);
    const namespace = schema.namespaces.find((item) => item.name.toLowerCase() === definitionName.toLowerCase());

    if (!namespace) {
        return {
            summary: `I could not find a definition named ${definitionName}.`,
            namespace: null,
        };
    }

    const relationLines = namespace.relations.length
        ? namespace.relations.map((relation) => `- relation ${relation.name}: ${relation.type}`).join('\n')
        : '- no relations defined';
    const permissionLines = namespace.permissions.length
        ? namespace.permissions.map((permission) => `- permission ${permission.name} = ${permission.expression}`).join('\n')
        : '- no permissions defined';

    return {
        summary: [
            `Definition ${namespace.name}:`,
            'Relations:',
            relationLines,
            'Permissions:',
            permissionLines,
        ].join('\n'),
        namespace,
    };
}

async function runPermissionCheck(client, { subjectToken, permission, resourceToken }) {
    const subject = parseSubjectToken(subjectToken);
    const resource = parseObjectToken(resourceToken);
    const request = v1.CheckPermissionRequest.create({
        resource: toObjectReference(resource),
        permission,
        subject: toSubjectReference(subject),
    });

    const data = await client.checkPermission(request);
    const permissionship = normalizePermissionship(data.permissionship);

    return {
        summary: `${subjectToken} ${permissionshipToSentence(permissionship)} ${resourceToken}#${permission}.`,
        subject: subjectToken,
        resource: resourceToken,
        permission,
        permissionship,
    };
}

async function lookupSubjects(client, { permission, resourceToken, subjectType }) {
    const resource = parseObjectToken(resourceToken);
    const request = v1.LookupSubjectsRequest.create({
        resource: toObjectReference(resource),
        permission,
        subjectObjectType: subjectType,
        wildcardOption: v1.LookupSubjectsRequest_WildcardOption.EXCLUDE_WILDCARDS,
    });

    const results = await client.lookupSubjects(request);
    const subjects = results
        .map((result) => result.subject)
        .filter(Boolean)
        .map((subject) => `${subject.subjectObjectType || subjectType}:${subject.subjectObjectId}${subject.optionalSubjectRelation ? `#${subject.optionalSubjectRelation}` : ''}`);

    if (!subjects.length) {
        return {
            summary: `No ${subjectType} subjects currently resolve ${resourceToken}#${permission}.`,
            subjects: [],
        };
    }

    return {
        summary: [
            `${subjects.length} ${subjectType} subject${subjects.length === 1 ? '' : 's'} resolve ${resourceToken}#${permission}:`,
            ...subjects.map((subject) => `- ${subject}`),
        ].join('\n'),
        subjects,
    };
}

async function summarizeRelationships(client, token) {
    const { objectType, objectId } = parseObjectToken(token, { allowMissingId: true });
    const request = v1.ReadRelationshipsRequest.create({
        relationshipFilter: v1.RelationshipFilter.create({
            resourceType: objectType,
            ...(objectId ? { optionalResourceId: objectId } : {}),
        }),
        optionalLimit: RELATIONSHIP_SAMPLE_LIMIT,
    });

    const results = await client.readRelationships(request);
    const relationships = results
        .map((result) => result.relationship)
        .filter(Boolean)
        .map((relationship) => formatRelationship(relationship));

    if (!relationships.length) {
        return {
            summary: `No relationships found for ${token}.`,
            relationships: [],
        };
    }

    return {
        summary: [
            `Showing up to ${RELATIONSHIP_SAMPLE_LIMIT} relationships for ${token}:`,
            ...relationships.map((relationship) => `- ${relationship}`),
        ].join('\n'),
        relationships,
    };
}

async function searchAuthZedDocs(query, limit = 5) {
    const result = await callAuthZedMcpTool('search_docs', {
        query,
        limit,
    });

    return {
        summary: result.summary,
        query,
        results: result.structuredContent,
        isError: result.isError,
    };
}

async function searchAuthZedApi(query, type = 'all', limit = 5) {
    const result = await callAuthZedMcpTool('search_api', {
        query,
        type,
        limit,
    });

    return {
        summary: result.summary,
        query,
        type,
        results: result.structuredContent,
        isError: result.isError,
    };
}

async function searchAuthZedExamples(query, limit = 5) {
    const result = await callAuthZedMcpTool('search_examples', {
        query,
        limit,
    });

    return {
        summary: result.summary,
        query,
        results: result.structuredContent,
        isError: result.isError,
    };
}

async function getParsedSchema(client) {
    const data = await client.readSchema(v1.ReadSchemaRequest.create({}));
    return {
        schemaText: data.schemaText || '',
        namespaces: parseNamespaces(data.schemaText || ''),
    };
}

function parseNamespaces(schema) {
    const namespaceRegex = /definition\s+(\w+)\s*\{/g;
    const namespaces = [];
    let match;

    while ((match = namespaceRegex.exec(schema)) !== null) {
        namespaces.push({
            name: match[1],
            relations: extractRelations(match[1], schema),
            permissions: extractPermissions(match[1], schema),
        });
    }

    return namespaces;
}

function extractRelations(namespace, schemaText) {
    const namespaceBlock = extractNamespaceBlock(namespace, schemaText);
    const relationRegex = /relation\s+(\w+):\s*([^\n\r]+)/g;
    const relations = [];
    let match;

    while ((match = relationRegex.exec(namespaceBlock)) !== null) {
        relations.push({
            name: match[1],
            type: match[2].trim(),
        });
    }

    return relations;
}

function extractPermissions(namespace, schemaText) {
    const namespaceBlock = extractNamespaceBlock(namespace, schemaText);
    const permissionRegex = /permission\s+(\w+)\s*=\s*([^\n\r]+)/g;
    const permissions = [];
    let match;

    while ((match = permissionRegex.exec(namespaceBlock)) !== null) {
        permissions.push({
            name: match[1],
            expression: match[2].trim(),
        });
    }

    return permissions;
}

function extractNamespaceBlock(namespace, schemaText) {
    const startRegex = new RegExp(`definition\\s+${namespace}\\s*\\{`);
    const startMatch = schemaText.match(startRegex);

    if (!startMatch || startMatch.index === undefined) {
        return '';
    }

    const startIndex = startMatch.index + startMatch[0].length;
    let braceCount = 1;
    let endIndex = startIndex;

    for (let index = startIndex; index < schemaText.length && braceCount > 0; index += 1) {
        if (schemaText[index] === '{') {
            braceCount += 1;
        }
        if (schemaText[index] === '}') {
            braceCount -= 1;
        }
        endIndex = index;
    }

    return schemaText.substring(startIndex, endIndex);
}

function parseObjectToken(token, options = {}) {
    const separatorIndex = token.indexOf(':');
    const objectType = separatorIndex >= 0 ? token.slice(0, separatorIndex) : token;
    const objectId = separatorIndex >= 0 ? token.slice(separatorIndex + 1) : '';

    if (!objectType || (!objectId && !options.allowMissingId)) {
        throw new AssistantApiError(`Invalid object reference: ${token}. Use type:id format.`, 400);
    }

    return { objectType, objectId };
}

function parseSubjectToken(token) {
    const [objectToken, relation = ''] = token.split('#');
    const object = parseObjectToken(objectToken);

    return relation ? { object, optionalRelation: relation } : { object };
}

function normalizePermissionship(permissionship) {
    switch (permissionship) {
        case 2:
        case '2':
        case 'HAS_PERMISSION':
        case 'PERMISSIONSHIP_HAS_PERMISSION':
            return 'HAS_PERMISSION';
        case 1:
        case '1':
        case 'NO_PERMISSION':
        case 'PERMISSIONSHIP_NO_PERMISSION':
            return 'NO_PERMISSION';
        case 3:
        case '3':
        case 'CONDITIONAL_PERMISSION':
        case 'PERMISSIONSHIP_CONDITIONAL_PERMISSION':
            return 'CONDITIONAL_PERMISSION';
        default:
            return 'UNKNOWN';
    }
}

function permissionshipToSentence(permissionship) {
    switch (permissionship) {
        case 'HAS_PERMISSION':
            return 'has permission on';
        case 'NO_PERMISSION':
            return 'does not have permission on';
        case 'CONDITIONAL_PERMISSION':
            return 'has conditional permission on';
        default:
            return 'has an unknown permission state for';
    }
}

function formatRelationship(relationship) {
    const resource = `${relationship.resource?.objectType}:${relationship.resource?.objectId}`;
    const subject = `${relationship.subject?.object?.objectType}:${relationship.subject?.object?.objectId}${relationship.subject?.optionalRelation ? `#${relationship.subject.optionalRelation}` : ''}`;
    return `${resource}#${relationship.relation}@${subject}`;
}

export function mapAssistantError(error) {
    const normalized = normalizeAssistantError(error);

    return {
        statusCode: normalized.statusCode || 500,
        body: {
            message: normalized.message,
            error: normalized.details || normalized.message,
            code: normalized.code,
        },
    };
}
