/**
 * Terminal API - Execute zed-like commands against SpiceDB
 * Uses SpiceDB HTTP API instead of requiring zed CLI binary
 */

function splitArgs(cmd) {
    const re = /[^\s"]+|"([^"]*)"/g;
    const out = [];
    let m;
    while ((m = re.exec(cmd)) !== null) {
        out.push(m[1] !== undefined ? m[1] : m[0]);
    }
    return out;
}

async function executeSchemaRead() {
    const url = process.env.SPICEDB_URL || 'http://localhost:8443';
    const token = process.env.SPICEDB_TOKEN || '';

    const response = await fetch(`${url}/v1/schema/read`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: '{}'
    });

    const data = await response.json();
    return data.schemaText || '';
}

async function executeRelationshipRead(resourceType, resourceId, relation, subjectType, subjectId) {
    const url = process.env.SPICEDB_URL || 'http://localhost:8443';
    const token = process.env.SPICEDB_TOKEN || '';

    const filter = {};
    if (resourceType) filter.resourceType = resourceType;
    if (resourceId) filter.resourceId = resourceId;
    if (relation) filter.relation = relation;
    if (subjectType && subjectId) {
        filter.subjectFilter = { subjectType, optionalSubjectId: subjectId };
    }

    const response = await fetch(`${url}/v1/relationships/read`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ relationshipFilter: filter })
    });

    const data = await response.json();
    const relationships = [];

    if (data.readRelationshipsResponseStream) {
        for (const item of data.readRelationshipsResponseStream) {
            if (item.relationship) {
                const rel = item.relationship;
                relationships.push(
                    `${rel.resource?.objectType}:${rel.resource?.objectId}#${rel.relation}@${rel.subject?.object?.objectType}:${rel.subject?.object?.objectId}`
                );
            }
        }
    }

    return relationships.length > 0 ? relationships.join('\n') : 'No relationships found';
}

async function executePermissionCheck(resourceType, resourceId, permission, subjectType, subjectId) {
    const url = process.env.SPICEDB_URL || 'http://localhost:8443';
    const token = process.env.SPICEDB_TOKEN || '';

    const response = await fetch(`${url}/v1/permissions/check`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            resource: { objectType: resourceType, objectId: resourceId },
            permission,
            subject: { object: { objectType: subjectType, objectId: subjectId } }
        })
    });

    const data = await response.json();
    return `Permissionship: ${data.permissionship || 'UNKNOWN'}`;
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const { command } = req.body || {};
    if (typeof command !== "string" || !command.trim()) {
        return res.status(400).json({ ok: false, error: "Command is required" });
    }

    const tokens = splitArgs(command.trim());
    if (tokens[0] !== "zed") {
        return res.status(400).json({ ok: false, error: 'Command must start with "zed"' });
    }

    const startedAt = Date.now();
    let stdout = "";
    let stderr = "";

    try {
        const subcommand = tokens[1];

        if (subcommand === "schema") {
            const action = tokens[2];
            if (action === "read") {
                stdout = await executeSchemaRead();
            } else {
                stderr = `Unsupported schema action: ${action}. Try: zed schema read`;
            }
        } else if (subcommand === "relationship") {
            const action = tokens[2];
            if (action === "read") {
                // Parse flags: --resource-type, --resource-id, --relation, --subject-type, --subject-id
                let resourceType, resourceId, relation, subjectType, subjectId;
                for (let i = 3; i < tokens.length; i++) {
                    if (tokens[i] === '--resource-type') resourceType = tokens[++i];
                    else if (tokens[i] === '--resource-id') resourceId = tokens[++i];
                    else if (tokens[i] === '--relation') relation = tokens[++i];
                    else if (tokens[i] === '--subject-type') subjectType = tokens[++i];
                    else if (tokens[i] === '--subject-id') subjectId = tokens[++i];
                }
                stdout = await executeRelationshipRead(resourceType, resourceId, relation, subjectType, subjectId);
            } else {
                stderr = `Unsupported relationship action: ${action}. Try: zed relationship read --resource-type <type>`;
            }
        } else if (subcommand === "permission") {
            const action = tokens[2];
            if (action === "check") {
                // Parse: zed permission check <resource-type>:<resource-id> <permission> <subject-type>:<subject-id>
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
                        stdout = await executePermissionCheck(resourceType, resourceId, permission, subjectType, subjectId);
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
            ok: stderr === "",
            code: stderr === "" ? 0 : 1,
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
            stderr: err?.message || "Command execution failed",
            error: err?.message || "Failed to execute command",
        });
    }
}
