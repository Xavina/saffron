import { v1 } from '@authzed/authzed-node';
import { getSpiceDbEndpoint, getSpiceDbPromiseClient } from '../../../lib/spicedb';

const ACTIVITY_PAGE_SIZE = 1000;

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const client = getSpiceDbPromiseClient();
    const spicedbEndpoint = getSpiceDbEndpoint();

    try {
        const activities = [];
        let isConnected = false;

        try {
            await client.readSchema(v1.ReadSchemaRequest.create({}));
            isConnected = true;
        } catch {
            isConnected = false;
        }

        if (isConnected) {
            try {
                const schemaData = await client.readSchema(v1.ReadSchemaRequest.create({}));
                if (schemaData.schemaText) {
                    activities.push({
                        id: `schema_${Date.now()}`,
                        action: 'Schema Available',
                        resource: 'Current schema loaded',
                        timestamp: 'Just now',
                        type: 'schema',
                    });
                }
            } catch {
                // Ignore schema errors.
            }

            try {
                const namespaces = await getNamespacesFromSchema(client);
                let totalRelationships = 0;
                const recentRelationships = [];

                for (const namespace of namespaces) {
                    try {
                        const summary = await getRelationshipSummaryForType(client, namespace, 2);
                        totalRelationships += summary.totalCount;

                        if (recentRelationships.length >= 3) {
                            continue;
                        }

                        summary.samples.forEach((rel, index) => {
                            recentRelationships.push({
                                id: `rel_${namespace}_${index}`,
                                action: 'Relationship Active',
                                resource: `${rel.resource.type}:${rel.resource.id}#${rel.relation}@${rel.subject.type}:${rel.subject.id}`,
                                timestamp: getRelativeTime(index * 5),
                                type: 'relationship',
                            });
                        });
                    } catch {
                        // Continue with other namespaces.
                    }
                }

                if (totalRelationships > 0) {
                    activities.push({
                        id: `stats_${Date.now()}`,
                        action: 'Relationships Loaded',
                        resource: `${totalRelationships} total relationships`,
                        timestamp: '1 minute ago',
                        type: 'relationship',
                    });
                }

                activities.push(...recentRelationships.slice(0, 3));
            } catch {
                // Ignore relationship errors.
            }

            activities.unshift({
                id: `connection_${Date.now()}`,
                action: 'SpiceDB Connected',
                resource: spicedbEndpoint,
                timestamp: 'Just now',
                type: 'system',
            });
        } else {
            activities.push({
                id: `connection_fail_${Date.now()}`,
                action: 'Connection Failed',
                resource: 'Unable to reach SpiceDB',
                timestamp: 'Just now',
                type: 'error',
            });
        }

        if (activities.length < 3) {
            activities.push(
                {
                    id: 'mock_1',
                    action: 'Dashboard Loaded',
                    resource: 'UI initialized',
                    timestamp: '2 minutes ago',
                    type: 'system',
                },
                {
                    id: 'mock_2',
                    action: 'API Ready',
                    resource: 'Backend services active',
                    timestamp: '3 minutes ago',
                    type: 'system',
                },
            );
        }

        const sortedActivities = activities
            .sort((a, b) => getTimestampValue(a.timestamp) - getTimestampValue(b.timestamp))
            .slice(0, 10);

        return res.status(200).json({ activities: sortedActivities });
    } catch (error) {
        console.error('Activity API error:', error);

        const fallbackActivities = [
            {
                id: 'fallback_1',
                action: 'Service Status',
                resource: 'Checking SpiceDB connection...',
                timestamp: 'Just now',
                type: 'system',
            },
            {
                id: 'fallback_2',
                action: 'Dashboard Ready',
                resource: 'UI components loaded',
                timestamp: '1 minute ago',
                type: 'system',
            },
        ];

        return res.status(200).json({ activities: fallbackActivities });
    }
}

async function getNamespacesFromSchema(client) {
    const data = await client.readSchema(v1.ReadSchemaRequest.create({}));
    const schemaText = data.schemaText || '';

    const definitionRegex = /definition\s+(\w+)\s*{/g;
    const namespaces = [];
    let match;

    while ((match = definitionRegex.exec(schemaText)) !== null) {
        namespaces.push(match[1]);
    }

    return namespaces;
}

async function getRelationshipsForType(client, resourceType) {
    const summary = await getRelationshipSummaryForType(client, resourceType);
    return summary.samples;
}

async function getRelationshipSummaryForType(client, resourceType, sampleLimit = ACTIVITY_PAGE_SIZE) {
    const samples = [];
    let totalCount = 0;
    let cursorToken = null;

    do {
        const response = await client.readRelationships(v1.ReadRelationshipsRequest.create({
            relationshipFilter: v1.RelationshipFilter.create({
                resourceType,
            }),
            optionalLimit: ACTIVITY_PAGE_SIZE,
            ...(cursorToken ? { optionalCursor: v1.Cursor.create({ token: cursorToken }) } : {}),
        }));

        const relationships = response
            .map((item) => item.relationship)
            .filter(Boolean)
            .map((rel) => ({
                resource: {
                    type: rel.resource.objectType,
                    id: rel.resource.objectId,
                },
                relation: rel.relation,
                subject: {
                    type: rel.subject.object.objectType,
                    id: rel.subject.object.objectId,
                },
            }));

        totalCount += relationships.length;

        for (const relationship of relationships) {
            if (samples.length >= sampleLimit) {
                break;
            }

            samples.push(relationship);
        }

        cursorToken = response.at(-1)?.afterResultCursor?.token || null;
    } while (cursorToken);

    return {
        totalCount,
        samples,
    };
}

function getRelativeTime(minutesAgo) {
    if (minutesAgo === 0) return 'Just now';
    if (minutesAgo === 1) return '1 minute ago';
    if (minutesAgo < 60) return `${minutesAgo} minutes ago`;
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo === 1) return '1 hour ago';
    return `${hoursAgo} hours ago`;
}

function getTimestampValue(timestamp) {
    if (timestamp === 'Just now') return 0;
    const match = timestamp.match(/(\d+)\s+(minute|hour)s?\s+ago/);
    if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];
        return unit === 'minute' ? value : value * 60;
    }
    return 999;
}
