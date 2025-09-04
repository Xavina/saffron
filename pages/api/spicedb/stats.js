export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const spicedbUrl = process.env.SPICEDB_URL || 'http://localhost:8080';
    const token = process.env.SPICEDB_TOKEN || 'somerandomkeyhere';

    try {
        let stats = {
            totalNamespaces: 0,
            totalRelationships: 0,
            totalSubjects: 0,
            uniqueResourceTypes: [],
            uniqueSubjectTypes: [],
            lastUpdate: new Date().toISOString(),
            isConnected: false
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
                const namespaces = extractNamespacesFromSchema(schemaData.schemaText || '');
                stats.totalNamespaces = namespaces.length;
                stats.uniqueResourceTypes = namespaces;
            }
        } catch (error) {
            console.error('Error fetching schema:', error);
            stats.isConnected = false;
        }

        res.status(200).json(stats);

    } catch (error) {
        console.error('Stats API error:', error);
        res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }
}

// Helper function to extract namespaces from schema
function extractNamespacesFromSchema(schemaText) {
    const definitionRegex = /definition\s+(\w+)\s*{/g;
    const namespaces = [];
    let match;

    while ((match = definitionRegex.exec(schemaText)) !== null) {
        namespaces.push(match[1]);
    }

    return namespaces;
}

