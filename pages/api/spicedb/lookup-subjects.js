import { v1 } from '@authzed/authzed-node';
import { getSpiceDbPromiseClient, mapGrpcError, toObjectReference, toStruct } from '../../../lib/spicedb';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { resource, permission, subjectObjectType } = req.body;

        if (!resource || !permission || !subjectObjectType) {
            return res.status(400).json({
                message: 'Missing required fields: resource, permission, subjectObjectType'
            });
        }

        const client = getSpiceDbPromiseClient();
        const request = v1.LookupSubjectsRequest.create({
            resource: toObjectReference(resource),
            permission,
            subjectObjectType,
            wildcardOption: v1.LookupSubjectsRequest_WildcardOption.EXCLUDE_WILDCARDS,
            ...(req.body.context && { context: toStruct(req.body.context) }),
        });

        const results = await client.lookupSubjects(request);
        const subjects = results
            .map((result) => result.subject)
            .filter(Boolean)
            .map((subject) => ({
                object: {
                    objectType: subject.subjectObjectType || subjectObjectType,
                    objectId: subject.subjectObjectId,
                },
                optionalRelation: subject.optionalSubjectRelation || '',
            }));

        res.status(200).json({ subjects });

    } catch (error) {
        console.error('Lookup subjects API error:', error);
        res.status(500).json({
            message: mapGrpcError(error).message,
            error: error.message,
            code: error.code,
        });
    }
}
