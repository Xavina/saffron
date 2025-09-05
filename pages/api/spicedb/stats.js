export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const spicedbUrl = process.env.SPICEDB_URL || 'http://localhost:8080';
    const token = process.env.SPICEDB_TOKEN || 'somerandomkeyhere';

    try {
        const startTime = Date.now();
        let stats = {
            totalNamespaces: 0,
            totalRelationships: 0,
            totalSubjects: 0,
            uniqueResourceTypes: [],
            uniqueSubjectTypes: [],
            lastUpdate: new Date().toISOString(),
            isConnected: false,
            schemaHash: null,
            apiResponseTime: null,
            namespacesWithRelationCounts: []
        };

        // Test connection and get schema
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
                stats.isConnected = true;
                const schemaData = await schemaResponse.json();
                const schemaText = schemaData.schemaText || '';
                
                // Calculate simple hash for schema
                let hash = 0;
                for (let i = 0; i < schemaText.length; i++) {
                    const char = schemaText.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                stats.schemaHash = Math.abs(hash).toString(16);
                
                // Extract namespace details from schema
                const namespaceDetails = extractNamespaceDetailsFromSchema(schemaText);
                stats.totalNamespaces = namespaceDetails.length;
                stats.uniqueResourceTypes = namespaceDetails.map(ns => ns.name);
                
                // Get relationship counts for each namespace
                stats.namespacesWithRelationCounts = await getNamespaceRelationshipCounts(
                    spicedbUrl, 
                    token, 
                    namespaceDetails
                );
                
                // Calculate totals
                stats.totalRelationships = stats.namespacesWithRelationCounts.reduce(
                    (sum, ns) => sum + ns.relationshipCount, 0
                );
                stats.totalSubjects = stats.namespacesWithRelationCounts.reduce(
                    (sum, ns) => sum + ns.subjectCount, 0
                );
            }
        } catch (error) {
            console.error('Error fetching schema:', error);
            stats.isConnected = false;
        }

        const endTime = Date.now();
        stats.apiResponseTime = endTime - startTime;

        res.status(200).json(stats);

    } catch (error) {
        console.error('Stats API error:', error);
        res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }
}

// Helper function to extract namespace details from schema
function extractNamespaceDetailsFromSchema(schemaText) {
    const definitionRegex = /definition\s+(\w+)\s*{([^}]*)}/g;
    const namespaces = [];
    let match;

    while ((match = definitionRegex.exec(schemaText)) !== null) {
        const name = match[1];
        const content = match[2];
        
        // Extract relations from the namespace content
        const relationRegex = /relation\s+(\w+):/g;
        const relations = [];
        let relationMatch;
        while ((relationMatch = relationRegex.exec(content)) !== null) {
            relations.push(relationMatch[1]);
        }
        
        namespaces.push({
            name,
            relations
        });
    }

    return namespaces;
}

// Helper function to extract namespaces from schema (keeping for backward compatibility)
function extractNamespacesFromSchema(schemaText) {
    const definitionRegex = /definition\s+(\w+)\s*{/g;
    const namespaces = [];
    let match;

    while ((match = definitionRegex.exec(schemaText)) !== null) {
        namespaces.push(match[1]);
    }

    return namespaces;
}

// Get relationship counts for each namespace
async function getNamespaceRelationshipCounts(spicedbUrl, token, namespaceDetails) {
    const namespacesWithCounts = [];
    
    for (const ns of namespaceDetails) {
        try {
            // Query relationships for this namespace
            const response = await fetch(`${spicedbUrl}/v1/relationships/read`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    relationshipFilter: {
                        resourceType: ns.name
                    },
                    limit: 1000
                })
            });

            if (response.ok) {
                const data = await response.json();
                const relationships = data.relationships || [];
                
                // Count unique subjects
                const uniqueSubjects = new Set();
                relationships.forEach(rel => {
                    if (rel.subject) {
                        uniqueSubjects.add(`${rel.subject.object?.objectType}:${rel.subject.object?.objectId}`);
                    }
                });

                namespacesWithCounts.push({
                    namespace: ns.name,
                    relationshipCount: relationships.length,
                    subjectCount: uniqueSubjects.size,
                    relationTypes: ns.relations || []
                });
            } else {
                // If query fails, still include namespace with zero counts
                namespacesWithCounts.push({
                    namespace: ns.name,
                    relationshipCount: 0,
                    subjectCount: 0,
                    relationTypes: ns.relations || []
                });
            }
        } catch (error) {
            console.error(`Error fetching relationships for ${ns.name}:`, error);
            // Include namespace with zero counts on error
            namespacesWithCounts.push({
                namespace: ns.name,
                relationshipCount: 0,
                subjectCount: 0,
                relationTypes: ns.relations || []
            });
        }
    }

    return namespacesWithCounts;
}

