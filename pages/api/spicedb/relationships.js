export default async function handler(req, res) {
    const spicedbUrl = process.env.SPICEDB_URL || 'http://localhost:8080';
    const token = process.env.SPICEDB_TOKEN || 'somerandomkeyhere';

    if (req.method === 'GET') {
        try {
            // Get query parameters for filtering
            const { resource_type, resource_id, relation, subject_type, subject_id } = req.query;

            let allRelationships = [];

            if (resource_type) {
                // If a specific resource type is requested, filter by it
                const relationships = await fetchRelationshipsForType(spicedbUrl, token, resource_type, resource_id, relation, subject_type, subject_id);
                allRelationships = relationships;
            } else {
                // If no specific type, we need to get all relationships by querying each known type
                // First, let's get the schema to know what types exist
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
                        const resourceTypes = extractResourceTypesFromSchema(schemaData.schemaText || '');

                        // Fetch relationships for each resource type
                        for (const type of resourceTypes) {
                            try {
                                const relationships = await fetchRelationshipsForType(spicedbUrl, token, type);
                                allRelationships = allRelationships.concat(relationships);
                            } catch (error) {
                                console.log(`No relationships found for type ${type}:`, error.message);
                                // Continue with other types
                            }
                        }
                    } else {
                        // If we can't get schema, try common types
                        const commonTypes = ['user', 'business', 'system', 'document', 'organization', 'folder'];
                        for (const type of commonTypes) {
                            try {
                                const relationships = await fetchRelationshipsForType(spicedbUrl, token, type);
                                allRelationships = allRelationships.concat(relationships);
                            } catch (error) {
                                // Ignore errors for types that don't exist
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error fetching schema for relationship types:', error);
                }
            }

            res.status(200).json({ relationships: allRelationships });

        } catch (error) {
            console.error('Relationships read API error:', error);
            res.status(500).json({
                message: 'Internal server error',
                error: error.message
            });
        }
    }
    else if (req.method === 'POST') {
        try {
            const body = req.body;

            console.log(body);
            console.log("1st", body.resource && body.relation && body.subject)
            console.log("2nd", body.resourceType && body.resourceId && body.subjectType && body.subjectId)

            // Check if it's a write operation (has resource, relation, subject)
            if (body.resource && body.relation && body.subject) {
                const { resource, relation, subject } = body;

                const response = await fetch(`${spicedbUrl}/v1/relationships/write`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        updates: [{
                            operation: 'OPERATION_CREATE',
                            relationship: { resource, relation, subject }
                        }]
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    return res.status(response.status).json({
                        message: `SpiceDB error: ${errorText}`
                    });
                }

                const data = await response.json();
                return res.status(200).json(data);
            }

            // Check if it's a delete operation (has resourceType, resourceId, etc.)
            else if (body.resourceType && body.resourceId && body.subjectType && body.subjectId) {
                const { resourceType, resourceId, subjectType, subjectId } = body;

                const response = await fetch(`${spicedbUrl}/v1/relationships/delete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        "relationshipFilter": {
                            "resourceType": resourceType,
                            "optionalResourceId": resourceId,
                            "optionalSubjectFilter": {
                                "subjectType": subjectType,
                                "optionalSubjectId": subjectId
                            }
                        }
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    return res.status(response.status).json({
                        message: `SpiceDB error: ${errorText}`
                    });
                }

                const data = await response.json();
                return res.status(200).json(data);
            }

            else {
                return res.status(400).json({
                    message: 'Invalid request body. Expected either (resource, relation, subject) for write or (resourceType, resourceId, subjectType, subjectId) for delete'
                });
            }

        } catch (error) {
            console.error('Relationships API error:', error);
            res.status(500).json({
                message: 'Internal server error',
                error: error.message
            });
        }
    }
    else {
        res.status(405).json({ message: 'Method not allowed' });
    }
}

// Helper function to fetch relationships for a specific resource type
async function fetchRelationshipsForType(spicedbUrl, token, resourceType, resourceId = null, relation = null, subjectType = null, subjectId = null) {
    const relationshipFilter = {
        resourceType: resourceType
    };

    if (resourceId) {
        relationshipFilter.optionalResourceId = resourceId;
    }

    if (relation) {
        relationshipFilter.optionalRelation = relation;
    }

    if (subjectType || subjectId) {
        relationshipFilter.optionalSubjectFilter = {
            subjectType: subjectType || '',
        };
        if (subjectId) {
            relationshipFilter.optionalSubjectFilter.optionalSubjectId = subjectId;
        }
    }

    const response = await fetch(`${spicedbUrl}/v1/relationships/read`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            relationshipFilter: relationshipFilter
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SpiceDB error: ${errorText}`);
    }

    const relationships = [];

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let boundary;
        while ((boundary = buffer.indexOf('\n')) >= 0) {
            const chunk = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 1);

            if (chunk) {
                try {
                    const parsed = JSON.parse(chunk);
                    const rel = parsed.result?.relationship;
                    if (rel) {
                        relationships.push(transformRelationship(rel));
                    }
                } catch (err) {
                    console.warn('Error parsing JSON chunk:', err);
                }
            }
        }
    }

    return relationships;
}


// Helper function to extract resource types from schema
function extractResourceTypesFromSchema(schemaText) {
    const definitionRegex = /definition\s+(\w+)\s*{/g;
    const types = [];
    let match;

    while ((match = definitionRegex.exec(schemaText)) !== null) {
        types.push(match[1]);
    }

    return types;
}

// Helper function to transform SpiceDB relationship format to our UI format
function transformRelationship(spicedbRel) {
    return {
        id: `${spicedbRel.resource.objectType}:${spicedbRel.resource.objectId}#${spicedbRel.relation}@${spicedbRel.subject.object.objectType}:${spicedbRel.subject.object.objectId}`,
        resource: {
            type: spicedbRel.resource.objectType,
            id: spicedbRel.resource.objectId
        },
        relation: spicedbRel.relation,
        subject: {
            type: spicedbRel.subject.object.objectType,
            id: spicedbRel.subject.object.objectId,
            ...(spicedbRel.subject.optionalRelation && { relation: spicedbRel.subject.optionalRelation })
        },
        createdAt: new Date().toISOString() // SpiceDB doesn't provide creation time in read response
    };
}