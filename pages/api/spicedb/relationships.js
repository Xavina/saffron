import { v1 } from '@authzed/authzed-node';
import { getSpiceDbPromiseClient, mapGrpcError, toObjectReference, toSubjectReference } from '../../../lib/spicedb';

const PAGE_SIZE = 100;

export default async function handler(req, res) {
    const client = getSpiceDbPromiseClient();

    if (req.method === 'GET') {
        try {
            const { resource_type, resource_id, relation, subject_type, subject_id, cursor } = req.query;

            const page = resource_type
                ? await fetchRelationshipsPageForType(client, {
                    resourceType: resource_type,
                    resourceId: resource_id,
                    relation,
                    subjectType: subject_type,
                    subjectId: subject_id,
                    cursor,
                })
                : await fetchRelationshipsPageAcrossTypes(client, cursor);

            return res.status(200).json(page);
        } catch (error) {
            console.error('Relationships read API error:', error);
            return res.status(500).json({
                message: mapGrpcError(error).message,
                error: error.message,
                code: error.code,
            });
        }
    }

    if (req.method === 'POST') {
        try {
            const body = req.body || {};

            if (body.resource && body.relation && body.subject) {
                const request = v1.WriteRelationshipsRequest.create({
                    updates: [
                        v1.RelationshipUpdate.create({
                            operation: v1.RelationshipUpdate_Operation.CREATE,
                            relationship: v1.Relationship.create({
                                resource: toObjectReference(body.resource),
                                relation: body.relation,
                                subject: toSubjectReference(body.subject),
                            }),
                        }),
                    ],
                });

                const data = await client.writeRelationships(request);
                return res.status(200).json(data);
            }

            if (body.resourceType && body.resourceId && body.subjectType && body.subjectId) {
                const request = v1.DeleteRelationshipsRequest.create({
                    relationshipFilter: v1.RelationshipFilter.create({
                        resourceType: body.resourceType,
                        optionalResourceId: body.resourceId,
                        optionalSubjectFilter: v1.SubjectFilter.create({
                            subjectType: body.subjectType,
                            optionalSubjectId: body.subjectId,
                        }),
                    }),
                });

                const data = await client.deleteRelationships(request);
                return res.status(200).json(data);
            }

            return res.status(400).json({
                message: 'Invalid request body. Expected either (resource, relation, subject) for write or (resourceType, resourceId, subjectType, subjectId) for delete',
            });
        } catch (error) {
            console.error('Relationships API error:', error);
            return res.status(500).json({
                message: mapGrpcError(error).message,
                error: error.message,
                code: error.code,
            });
        }
    }

    return res.status(405).json({ message: 'Method not allowed' });
}

function encodeCursor(payload) {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

function decodeCursor(cursor) {
    if (!cursor) {
        return null;
    }

    try {
        const decoded = Buffer.from(String(cursor), 'base64').toString('utf8');
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

async function fetchRelationshipsPageForType(client, {
    resourceType,
    resourceId = null,
    relation = null,
    subjectType = null,
    subjectId = null,
    cursor = null,
}) {
    const decodedCursor = decodeCursor(cursor);
    const cursorToken = decodedCursor?.kind === 'type' && decodedCursor.resourceType === resourceType
        ? decodedCursor.token
        : null;

    const relationshipFilter = v1.RelationshipFilter.create({
        resourceType,
        ...(resourceId ? { optionalResourceId: resourceId } : {}),
        ...(relation ? { optionalRelation: relation } : {}),
        ...(subjectType || subjectId
            ? {
                optionalSubjectFilter: v1.SubjectFilter.create({
                    subjectType: subjectType || '',
                    ...(subjectId ? { optionalSubjectId: subjectId } : {}),
                }),
            }
            : {}),
    });

    const request = v1.ReadRelationshipsRequest.create({
        relationshipFilter,
        optionalLimit: PAGE_SIZE,
        ...(cursorToken ? { optionalCursor: v1.Cursor.create({ token: cursorToken }) } : {}),
    });
    const results = await client.readRelationships(request);

    const lastResult = results.at(-1);
    const nextToken = lastResult?.afterResultCursor?.token || null;

    return {
        relationships: results
            .map((result) => result.relationship)
            .filter(Boolean)
            .map(transformRelationship),
        pageSize: PAGE_SIZE,
        nextCursor: nextToken
            ? encodeCursor({ kind: 'type', resourceType, token: nextToken })
            : null,
        hasNextPage: Boolean(nextToken),
    };
}

async function fetchRelationshipsPageAcrossTypes(client, cursor = null) {
    const resourceTypes = await getResourceTypes(client);
    const decodedCursor = decodeCursor(cursor);

    let startIndex = 0;
    let startToken = null;

    if (decodedCursor?.kind === 'all' && decodedCursor.resourceType) {
        const matchedIndex = resourceTypes.indexOf(decodedCursor.resourceType);
        if (matchedIndex >= 0) {
            startIndex = matchedIndex;
            startToken = decodedCursor.token || null;
        }
    }

    const relationships = [];

    for (let index = startIndex; index < resourceTypes.length && relationships.length < PAGE_SIZE; index += 1) {
        const resourceType = resourceTypes[index];
        const remaining = PAGE_SIZE - relationships.length;
        const page = await fetchTypeSlice(client, {
            resourceType,
            limit: remaining + 1,
            cursorToken: index === startIndex ? startToken : null,
        });

        if (page.relationships.length === 0) {
            continue;
        }

        if (page.relationships.length > remaining) {
            relationships.push(...page.relationships.slice(0, remaining).map(transformRelationship));
            return {
                relationships,
                pageSize: PAGE_SIZE,
                nextCursor: encodeCursor({
                    kind: 'all',
                    resourceType,
                    token: page.results[remaining - 1]?.afterResultCursor?.token || null,
                }),
                hasNextPage: true,
            };
        }

        relationships.push(...page.relationships.map(transformRelationship));

        if (relationships.length === PAGE_SIZE) {
            const nextCursor = await findNextCursorForTypes(client, resourceTypes, index + 1);
            return {
                relationships,
                pageSize: PAGE_SIZE,
                nextCursor,
                hasNextPage: Boolean(nextCursor),
            };
        }
    }

    return {
        relationships,
        pageSize: PAGE_SIZE,
        nextCursor: null,
        hasNextPage: false,
    };
}

async function fetchTypeSlice(client, { resourceType, limit, cursorToken = null }) {
    const request = v1.ReadRelationshipsRequest.create({
        relationshipFilter: v1.RelationshipFilter.create({ resourceType }),
        optionalLimit: limit,
        ...(cursorToken ? { optionalCursor: v1.Cursor.create({ token: cursorToken }) } : {}),
    });

    const results = await client.readRelationships(request);

    return {
        results,
        relationships: results.map((result) => result.relationship).filter(Boolean),
    };
}

async function findNextCursorForTypes(client, resourceTypes, startIndex) {
    for (let index = startIndex; index < resourceTypes.length; index += 1) {
        const resourceType = resourceTypes[index];
        const page = await fetchTypeSlice(client, { resourceType, limit: 1 });

        if (page.relationships.length > 0) {
            return encodeCursor({ kind: 'all', resourceType, token: null });
        }
    }

    return null;
}

async function getResourceTypes(client) {
    try {
        const schemaData = await client.readSchema(v1.ReadSchemaRequest.create({}));
        return extractResourceTypesFromSchema(schemaData.schemaText || '').sort();
    } catch (error) {
        console.error('Error fetching schema for relationship types:', error);
        return ['user', 'business', 'system', 'document', 'organization', 'folder'];
    }
}

function extractResourceTypesFromSchema(schemaText) {
    const definitionRegex = /definition\s+(\w+)\s*{/g;
    const types = [];
    let match;

    while ((match = definitionRegex.exec(schemaText)) !== null) {
        types.push(match[1]);
    }

    return types;
}

function transformRelationship(spicedbRel) {
    return {
        id: `${spicedbRel.resource.objectType}:${spicedbRel.resource.objectId}#${spicedbRel.relation}@${spicedbRel.subject.object.objectType}:${spicedbRel.subject.object.objectId}`,
        resource: {
            type: spicedbRel.resource.objectType,
            id: spicedbRel.resource.objectId,
        },
        relation: spicedbRel.relation,
        subject: {
            type: spicedbRel.subject.object.objectType,
            id: spicedbRel.subject.object.objectId,
            ...(spicedbRel.subject.optionalRelation ? { relation: spicedbRel.subject.optionalRelation } : {}),
        },
        createdAt: new Date().toISOString(),
    };
}
