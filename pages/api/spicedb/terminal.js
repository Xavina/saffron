import { v1 } from '@authzed/authzed-node';
import { getSpiceDbPromiseClient } from '../../../lib/spicedb';

function splitArgs(cmd) {
    const re = /[^\s"]+|"([^"]*)"/g;
    const out = [];
    let m;
    while ((m = re.exec(cmd)) !== null) {
        out.push(m[1] !== undefined ? m[1] : m[0]);
    }
    return out;
}

async function executeSchemaRead(client) {
    const response = await client.readSchema(v1.ReadSchemaRequest.create({}));
    return response.schemaText || '';
}

async function executeRelationshipRead(client, resourceType, resourceId, relation, subjectType, subjectId) {
    const relationshipFilter = v1.RelationshipFilter.create({
        ...(resourceType ? { resourceType } : {}),
        ...(resourceId ? { optionalResourceId: resourceId } : {}),
        ...(relation ? { optionalRelation: relation } : {}),
        ...(subjectType
            ? {
                optionalSubjectFilter: v1.SubjectFilter.create({
                    subjectType,
                    ...(subjectId ? { optionalSubjectId: subjectId } : {}),
                }),
            }
            : {}),
    });

    const data = await client.readRelationships(v1.ReadRelationshipsRequest.create({ relationshipFilter }));

    const relationships = data
        .map((item) => item.relationship)
        .filter(Boolean)
        .map((rel) => `${rel.resource?.objectType}:${rel.resource?.objectId}#${rel.relation}@${rel.subject?.object?.objectType}:${rel.subject?.object?.objectId}`);

    return relationships.length > 0 ? relationships.join('\n') : 'No relationships found';
}

async function executePermissionCheck(client, resourceType, resourceId, permission, subjectType, subjectId) {
    const response = await client.checkPermission(v1.CheckPermissionRequest.create({
        resource: v1.ObjectReference.create({ objectType: resourceType, objectId: resourceId }),
        permission,
        subject: v1.SubjectReference.create({
            object: v1.ObjectReference.create({ objectType: subjectType, objectId: subjectId }),
        }),
    }));

    return `Permissionship: ${response.permissionship || 'UNKNOWN'}`;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const { command } = req.body || {};
    if (typeof command !== 'string' || !command.trim()) {
        return res.status(400).json({ ok: false, error: 'Command is required' });
    }

    const tokens = splitArgs(command.trim());
    if (tokens[0] !== 'zed') {
        return res.status(400).json({ ok: false, error: 'Command must start with "zed"' });
    }

    const startedAt = Date.now();
    let stdout = '';
    let stderr = '';

    try {
        const client = getSpiceDbPromiseClient();
        const subcommand = tokens[1];

        if (subcommand === 'schema') {
            const action = tokens[2];
            if (action === 'read') {
                stdout = await executeSchemaRead(client);
            } else {
                stderr = `Unsupported schema action: ${action}. Try: zed schema read`;
            }
        } else if (subcommand === 'relationship') {
            const action = tokens[2];
            if (action === 'read') {
                let resourceType;
                let resourceId;
                let relation;
                let subjectType;
                let subjectId;
                for (let i = 3; i < tokens.length; i++) {
                    if (tokens[i] === '--resource-type') resourceType = tokens[++i];
                    else if (tokens[i] === '--resource-id') resourceId = tokens[++i];
                    else if (tokens[i] === '--relation') relation = tokens[++i];
                    else if (tokens[i] === '--subject-type') subjectType = tokens[++i];
                    else if (tokens[i] === '--subject-id') subjectId = tokens[++i];
                }
                stdout = await executeRelationshipRead(client, resourceType, resourceId, relation, subjectType, subjectId);
            } else {
                stderr = `Unsupported relationship action: ${action}. Try: zed relationship read --resource-type <type>`;
            }
        } else if (subcommand === 'permission') {
            const action = tokens[2];
            if (action === 'check') {
                const resource = tokens[3];
                const permission = tokens[4];
                const subject = tokens[5];

                if (!resource || !permission || !subject) {
                    stderr = 'Usage: zed permission check <resource-type>:<resource-id> <permission> <subject-type>:<subject-id>';
                } else {
                    const [resourceType, resourceId] = resource.split(':');
                    const [subjectType, subjectId] = subject.split(':');

                    if (!resourceType || !resourceId || !subjectType || !subjectId) {
                        stderr = 'Invalid format. Use type:id for resource and subject';
                    } else {
                        stdout = await executePermissionCheck(client, resourceType, resourceId, permission, subjectType, subjectId);
                    }
                }
            } else {
                stderr = `Unsupported permission action: ${action}. Try: zed permission check <resource> <permission> <subject>`;
            }
        } else {
            stderr = `Unsupported command: ${subcommand}. Supported: schema, relationship, permission`;
        }

        const endedAt = Date.now();
        return res.status(200).json({
            ok: stderr === '',
            code: stderr === '' ? 0 : 1,
            stdout,
            stderr,
            startedAt: new Date(startedAt).toISOString(),
            endedAt: new Date(endedAt).toISOString(),
            durationMs: endedAt - startedAt,
        });
    } catch (err) {
        return res.status(500).json({
            ok: false,
            code: null,
            stdout,
            stderr: err?.message || 'Command execution failed',
            error: err?.message || 'Failed to execute command',
        });
    }
}
