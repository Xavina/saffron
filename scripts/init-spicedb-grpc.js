#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { v1 } = require('@authzed/authzed-node');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'examples', 'spicedb', 'data', 'schema.yml');

function log(message) {
    process.stdout.write(`${message}\n`);
}

function getEnv(name, fallback) {
    const value = process.env[name];
    return value === undefined || value === '' ? fallback : value;
}

function asBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
        return false;
    }

    return fallback;
}

function normalizeEndpoint(rawEndpoint) {
    if (rawEndpoint.startsWith('http://') || rawEndpoint.startsWith('https://')) {
        try {
            const url = new URL(rawEndpoint);
            return `${url.hostname}:${url.port || '50051'}`;
        } catch {
            return rawEndpoint;
        }
    }
    return rawEndpoint;
}

function extractBlock(content, blockName, nextBlockName) {
    const start = content.indexOf(`${blockName}: |-`);
    if (start < 0) {
        throw new Error(`Could not find '${blockName}: |-' block in ${DATA_FILE}`);
    }

    const from = content.indexOf('\n', start) + 1;
    const end = nextBlockName ? content.indexOf(`\n${nextBlockName}:`, from) : -1;
    const block = end >= 0 ? content.slice(from, end) : content.slice(from);

    return block
        .split('\n')
        .map((line) => (line.startsWith('  ') ? line.slice(2) : line))
        .join('\n')
        .trimEnd();
}

function parseReference(value) {
    const [type, idAndRelation] = value.split(':');
    if (!type || !idAndRelation) {
        throw new Error(`Invalid reference: ${value}`);
    }

    const [id, optionalRelation] = idAndRelation.split('#');
    return {
        objectType: type,
        objectId: id,
        optionalRelation: optionalRelation || '',
    };
}

function parseRelationship(line) {
    const [left, subjectRaw] = line.split('@');
    if (!left || !subjectRaw) {
        throw new Error(`Invalid relationship tuple: ${line}`);
    }

    const [resourceRaw, relation] = left.split('#');
    if (!resourceRaw || !relation) {
        throw new Error(`Invalid resource relation tuple: ${line}`);
    }

    const resource = parseReference(resourceRaw);
    const subjectRef = parseReference(subjectRaw);

    return {
        resource: {
            objectType: resource.objectType,
            objectId: resource.objectId,
        },
        relation,
        subject: {
            object: {
                objectType: subjectRef.objectType,
                objectId: subjectRef.objectId,
            },
            ...(subjectRef.optionalRelation ? { optionalRelation: subjectRef.optionalRelation } : {}),
        },
    };
}

async function waitForSpiceDb(client) {
    for (;;) {
        try {
            await client.readSchema(v1.ReadSchemaRequest.create({}));
            return;
        } catch {
            log('  Waiting for SpiceDB...');
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }
}

async function main() {
    const endpoint = normalizeEndpoint(getEnv('SPICEDB_ENDPOINT', 'localhost:50051'));
    const token = getEnv('SPICEDB_PRESHARED_KEY', getEnv('SPICEDB_TOKEN', 'saffron-dev-key'));
    const insecure = asBoolean(getEnv('SPICEDB_INSECURE', 'true'), true);

    const security = insecure
        ? v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS
        : v1.ClientSecurity.SECURE;

    const { promises: client } = v1.NewClient(token, endpoint, security);

    const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
    const schema = extractBlock(fileContent, 'schema', 'relationships');
    const relationshipBlock = extractBlock(fileContent, 'relationships', 'assertions');

    const relationships = relationshipBlock
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('//'))
        .map(parseRelationship);

    log('🚀 Initializing SpiceDB with mock data...');
    log('⏳ Waiting for SpiceDB to be ready...');
    await waitForSpiceDb(client);
    log('✅ SpiceDB is ready!');

    log('📝 Writing schema...');
    await client.writeSchema(v1.WriteSchemaRequest.create({ schema }));
    log('✅ Schema written successfully!');

    log('📊 Writing relationships...');
    await client.writeRelationships(v1.WriteRelationshipsRequest.create({
        updates: relationships.map((relationship) => v1.RelationshipUpdate.create({
            operation: v1.RelationshipUpdate_Operation.TOUCH,
            relationship: v1.Relationship.create(relationship),
        })),
    }));
    log('✅ Relationships written successfully!');

    log('');
    log('🎉 SpiceDB initialization complete!');
}

main().catch((error) => {
    console.error('Initialization failed:', error.message);
    process.exit(1);
});
