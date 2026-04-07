import { v1 } from '@authzed/authzed-node';
import { getSpiceDbPromiseClient } from '../../../lib/spicedb';

function withTimeout(promise, timeoutMs) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
        }),
    ]);
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const client = getSpiceDbPromiseClient();

    try {
        const startTime = Date.now();
        const stats = {
            totalNamespaces: 0,
            totalRelationships: 0,
            totalSubjects: 0,
            uniqueResourceTypes: [],
            uniqueSubjectTypes: [],
            lastUpdate: new Date().toISOString(),
            isConnected: false,
            schemaHash: null,
            apiResponseTime: null,
            namespacesWithRelationCounts: [],
        };

        try {
            const schemaData = await withTimeout(
                client.readSchema(v1.ReadSchemaRequest.create({})),
                3000,
            );

            stats.isConnected = true;
            const schemaText = schemaData.schemaText || '';

            let hash = 0;
            for (let i = 0; i < schemaText.length; i++) {
                const char = schemaText.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash &= hash;
            }
            stats.schemaHash = Math.abs(hash).toString(16);

            const namespaceDetails = extractNamespaceDetailsFromSchema(schemaText);
            stats.totalNamespaces = namespaceDetails.length;
            stats.uniqueResourceTypes = namespaceDetails.map((ns) => ns.name);

            stats.namespacesWithRelationCounts = await getNamespaceRelationshipCounts(client, namespaceDetails);

            stats.totalRelationships = stats.namespacesWithRelationCounts.reduce((sum, ns) => sum + ns.relationshipCount, 0);
            stats.totalSubjects = stats.namespacesWithRelationCounts.reduce((sum, ns) => sum + ns.subjectCount, 0);

            const uniqueSubjects = new Set();
            stats.namespacesWithRelationCounts.forEach((ns) => {
                ns.subjectTypes.forEach((subjectType) => uniqueSubjects.add(subjectType));
            });
            stats.uniqueSubjectTypes = Array.from(uniqueSubjects);
        } catch (error) {
            console.error('Error fetching schema:', error);
            stats.isConnected = false;
        }

        stats.apiResponseTime = Date.now() - startTime;

        try {
            await fetch(`http://localhost:7777/api/spicedb/health-history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connected: stats.isConnected,
                    responseTime: stats.apiResponseTime,
                    timestamp: stats.lastUpdate,
                }),
            });
        } catch (error) {
            console.error('Failed to log health history:', error);
        }

        return res.status(200).json(stats);
    } catch (error) {
        console.error('Stats API error:', error);
        return res.status(500).json({
            message: 'Internal server error',
            error: error.message,
        });
    }
}

function extractNamespaceDetailsFromSchema(schemaText) {
    const definitionRegex = /definition\s+(\w+)\s*{([^}]*)}/g;
    const namespaces = [];
    let match;

    while ((match = definitionRegex.exec(schemaText)) !== null) {
        const name = match[1];
        const content = match[2];

        const relationRegex = /relation\s+(\w+):/g;
        const relations = [];
        let relationMatch;
        while ((relationMatch = relationRegex.exec(content)) !== null) {
            relations.push(relationMatch[1]);
        }

        namespaces.push({ name, relations });
    }

    return namespaces;
}

async function getNamespaceRelationshipCounts(client, namespaceDetails) {
    const namespacesWithCounts = [];

    for (const ns of namespaceDetails) {
        try {
            const response = await withTimeout(
                client.readRelationships(v1.ReadRelationshipsRequest.create({
                    relationshipFilter: v1.RelationshipFilter.create({
                        resourceType: ns.name,
                    }),
                    optionalLimit: 1000,
                })),
                2000,
            );

            const relationships = response
                .map((item) => item.relationship)
                .filter(Boolean);

            const uniqueSubjects = new Set();
            const subjectTypes = new Set();

            relationships.forEach((rel) => {
                if (rel.subject?.object) {
                    uniqueSubjects.add(`${rel.subject.object.objectType}:${rel.subject.object.objectId}`);
                    subjectTypes.add(rel.subject.object.objectType);
                }
            });

            namespacesWithCounts.push({
                namespace: ns.name,
                relationshipCount: relationships.length,
                subjectCount: uniqueSubjects.size,
                relationTypes: ns.relations || [],
                subjectTypes: Array.from(subjectTypes),
            });
        } catch (error) {
            console.error(`Error fetching relationships for ${ns.name}:`, error);
            namespacesWithCounts.push({
                namespace: ns.name,
                relationshipCount: 0,
                subjectCount: 0,
                relationTypes: ns.relations || [],
                subjectTypes: [],
            });
        }
    }

    return namespacesWithCounts;
}
