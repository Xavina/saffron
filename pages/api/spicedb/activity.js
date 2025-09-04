// This API simulates recent activity since SpiceDB doesn't provide activity logs
// In a real implementation, you might want to maintain your own activity log
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const spicedbUrl = process.env.SPICEDB_URL || 'http://localhost:8080';
    const token = process.env.SPICEDB_TOKEN || 'somerandomkeyhere';

    try {
        const activities = [];

        // Check if we can connect to SpiceDB
        let isConnected = false;
        try {
            const healthResponse = await fetch(`${spicedbUrl}/v1/schema/read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({})
            });
            isConnected = healthResponse.ok;
        } catch (error) {
            isConnected = false;
        }

        if (isConnected) {
            // Get recent schema info
            try {
                const schemaResponse = await fetch(`${spicedbUrl}/v1/schema/read`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({})
                });

                if (schemaResponse.ok) {
                    const schemaData = await schemaResponse.json();
                    if (schemaData.schema_text) {
                        activities.push({
                            id: `schema_${Date.now()}`,
                            action: 'Schema Available',
                            resource: 'Current schema loaded',
                            timestamp: 'Just now',
                            type: 'schema'
                        });
                    }
                }
            } catch (error) {
                // Ignore schema errors
            }

            // Get recent relationships info
            try {
                const namespaces = await getNamespacesFromSchema(spicedbUrl, token);
                let totalRelationships = 0;
                let recentRelationships = [];

                for (const namespace of namespaces.slice(0, 3)) { // Check first 3 namespaces
                    try {
                        const relationships = await getRelationshipsForType(spicedbUrl, token, namespace);
                        totalRelationships += relationships.length;

                        // Add recent relationships to activity
                        relationships.slice(0, 2).forEach((rel, index) => {
                            recentRelationships.push({
                                id: `rel_${namespace}_${index}`,
                                action: 'Relationship Active',
                                resource: `${rel.resource.type}:${rel.resource.id}#${rel.relation}@${rel.subject.type}:${rel.subject.id}`,
                                timestamp: getRelativeTime(index * 5), // Simulate different times
                                type: 'relationship'
                            });
                        });
                    } catch (error) {
                        // Continue with other namespaces
                    }
                }

                if (totalRelationships > 0) {
                    activities.push({
                        id: `stats_${Date.now()}`,
                        action: 'Relationships Loaded',
                        resource: `${totalRelationships} total relationships`,
                        timestamp: '1 minute ago',
                        type: 'relationship'
                    });
                }

                // Add relationship activities
                activities.push(...recentRelationships.slice(0, 3));

            } catch (error) {
                // Ignore relationship errors
            }

            // Add connection success activity
            activities.unshift({
                id: `connection_${Date.now()}`,
                action: 'SpiceDB Connected',
                resource: spicedbUrl,
                timestamp: 'Just now',
                type: 'system'
            });

        } else {
            // Add connection failure activity
            activities.push({
                id: `connection_fail_${Date.now()}`,
                action: 'Connection Failed',
                resource: 'Unable to reach SpiceDB',
                timestamp: 'Just now',
                type: 'error'
            });
        }

        // Ensure we have some activities (fallback to mock data if needed)
        if (activities.length < 3) {
            activities.push(
                {
                    id: `mock_1`,
                    action: 'Dashboard Loaded',
                    resource: 'UI initialized',
                    timestamp: '2 minutes ago',
                    type: 'system'
                },
                {
                    id: `mock_2`,
                    action: 'API Ready',
                    resource: 'Backend services active',
                    timestamp: '3 minutes ago',
                    type: 'system'
                }
            );
        }

        // Sort by most recent and limit to 10
        const sortedActivities = activities
            .sort((a, b) => getTimestampValue(a.timestamp) - getTimestampValue(b.timestamp))
            .slice(0, 10);

        res.status(200).json({ activities: sortedActivities });

    } catch (error) {
        console.error('Activity API error:', error);

        // Return fallback mock data on error
        const fallbackActivities = [
            {
                id: 'fallback_1',
                action: 'Service Status',
                resource: 'Checking SpiceDB connection...',
                timestamp: 'Just now',
                type: 'system'
            },
            {
                id: 'fallback_2',
                action: 'Dashboard Ready',
                resource: 'UI components loaded',
                timestamp: '1 minute ago',
                type: 'system'
            }
        ];

        res.status(200).json({ activities: fallbackActivities });
    }
}

// Helper functions
async function getNamespacesFromSchema(spicedbUrl, token) {
    const response = await fetch(`${spicedbUrl}/v1/schema/read`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({})
    });

    if (!response.ok) {
        throw new Error('Failed to fetch schema');
    }

    const data = await response.json();
    const schemaText = data.schema_text || '';

    const definitionRegex = /definition\s+(\w+)\s*{/g;
    const namespaces = [];
    let match;

    while ((match = definitionRegex.exec(schemaText)) !== null) {
        namespaces.push(match[1]);
    }

    return namespaces;
}

async function getRelationshipsForType(spicedbUrl, token, resourceType) {
    const response = await fetch(`${spicedbUrl}/v1/relationships/read`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            relationship_filter: {
                resource_type: resourceType
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch relationships for ${resourceType}`);
    }

    const responseText = await response.text();
    const relationships = [];

    if (!responseText.trim()) {
        return relationships;
    }

    const jsonPattern = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
    const matches = responseText.match(jsonPattern);

    if (matches) {
        for (const match of matches) {
            try {
                const data = JSON.parse(match);
                if (data.result && data.result.relationship) {
                    const rel = data.result.relationship;
                    relationships.push({
                        resource: {
                            type: rel.resource.objectType,
                            id: rel.resource.objectId
                        },
                        relation: rel.relation,
                        subject: {
                            type: rel.subject.object.objectType,
                            id: rel.subject.object.objectId
                        }
                    });
                }
            } catch (parseError) {
                // Skip invalid JSON
            }
        }
    }

    return relationships;
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
        const value = parseInt(match[1]);
        const unit = match[2];
        return unit === 'minute' ? value : value * 60;
    }
    return 999; // Unknown timestamps go to the end
}