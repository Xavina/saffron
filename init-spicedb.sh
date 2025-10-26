#!/bin/bash

# Initialize SpiceDB with schema and mock data
# Usage: ./init-spicedb.sh

set -e

SPICEDB_ENDPOINT="localhost:8443"
PRESHARED_KEY="saffron-dev-key"

echo "🚀 Initializing SpiceDB with mock data..."

# Wait for SpiceDB to be ready
echo "⏳ Waiting for SpiceDB to be ready..."
until curl -s -H "Authorization: Bearer ${PRESHARED_KEY}" \
  "http://${SPICEDB_ENDPOINT}/v1/schema/read" > /dev/null 2>&1; do
  echo "  Waiting for SpiceDB..."
  sleep 2
done
echo "✅ SpiceDB is ready!"

# Write the schema
echo "📝 Writing schema..."
curl -X POST "http://${SPICEDB_ENDPOINT}/v1/schema/write" \
  -H "Authorization: Bearer ${PRESHARED_KEY}" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "schema": "definition user {}\n\ndefinition resource {\n    relation manager: user | usergroup#member | usergroup#manager\n    relation viewer: user | usergroup#member | usergroup#manager\n    permission manage = manager\n    permission view = viewer + manager\n}\n\ndefinition usergroup {\n    relation manager: user | usergroup#member | usergroup#manager\n    relation direct_member: user | usergroup#member | usergroup#manager\n    permission member = direct_member + manager\n}\n\ndefinition organization {\n    relation group: usergroup\n    relation administrator: user | usergroup#member | usergroup#manager\n    relation direct_member: user\n    relation resource: resource\n    permission admin = administrator\n    permission member = direct_member + administrator + group->member\n}"
}
EOF
echo ""
echo "✅ Schema written successfully!"

# Write relationships
echo "📊 Writing relationships..."
curl -X POST "http://${SPICEDB_ENDPOINT}/v1/relationships/write" \
  -H "Authorization: Bearer ${PRESHARED_KEY}" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "updates": [
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "usergroup", "objectId": "productname"},
        "relation": "manager",
        "subject": {"object": {"objectType": "user", "objectId": "an_eng_manager"}}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "usergroup", "objectId": "productname"},
        "relation": "direct_member",
        "subject": {"object": {"objectType": "user", "objectId": "an_engineer"}}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "usergroup", "objectId": "applications"},
        "relation": "manager",
        "subject": {"object": {"objectType": "user", "objectId": "an_eng_director"}}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "usergroup", "objectId": "engineering"},
        "relation": "manager",
        "subject": {"object": {"objectType": "user", "objectId": "cto"}}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "usergroup", "objectId": "csuite"},
        "relation": "manager",
        "subject": {"object": {"objectType": "user", "objectId": "ceo"}}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "usergroup", "objectId": "csuite"},
        "relation": "direct_member",
        "subject": {"object": {"objectType": "user", "objectId": "cto"}}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "usergroup", "objectId": "engineering"},
        "relation": "direct_member",
        "subject": {"object": {"objectType": "usergroup", "objectId": "applications"}, "optionalRelation": "member"}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "usergroup", "objectId": "applications"},
        "relation": "direct_member",
        "subject": {"object": {"objectType": "usergroup", "objectId": "productname"}, "optionalRelation": "member"}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "usergroup", "objectId": "engineering"},
        "relation": "direct_member",
        "subject": {"object": {"objectType": "usergroup", "objectId": "csuite"}, "optionalRelation": "member"}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "organization", "objectId": "org1"},
        "relation": "group",
        "subject": {"object": {"objectType": "usergroup", "objectId": "csuite"}}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "organization", "objectId": "org1"},
        "relation": "group",
        "subject": {"object": {"objectType": "usergroup", "objectId": "productname"}}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "organization", "objectId": "org1"},
        "relation": "group",
        "subject": {"object": {"objectType": "usergroup", "objectId": "applications"}}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "organization", "objectId": "org1"},
        "relation": "group",
        "subject": {"object": {"objectType": "usergroup", "objectId": "engineering"}}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "organization", "objectId": "org1"},
        "relation": "resource",
        "subject": {"object": {"objectType": "resource", "objectId": "promserver"}}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "organization", "objectId": "org1"},
        "relation": "resource",
        "subject": {"object": {"objectType": "resource", "objectId": "jira"}}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "organization", "objectId": "org1"},
        "relation": "administrator",
        "subject": {"object": {"objectType": "usergroup", "objectId": "csuite"}, "optionalRelation": "member"}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "organization", "objectId": "org1"},
        "relation": "administrator",
        "subject": {"object": {"objectType": "user", "objectId": "it_admin"}}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "resource", "objectId": "promserver"},
        "relation": "manager",
        "subject": {"object": {"objectType": "usergroup", "objectId": "productname"}, "optionalRelation": "member"}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "resource", "objectId": "promserver"},
        "relation": "viewer",
        "subject": {"object": {"objectType": "usergroup", "objectId": "engineering"}, "optionalRelation": "member"}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "resource", "objectId": "jira"},
        "relation": "viewer",
        "subject": {"object": {"objectType": "usergroup", "objectId": "engineering"}, "optionalRelation": "member"}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "resource", "objectId": "jira"},
        "relation": "manager",
        "subject": {"object": {"objectType": "usergroup", "objectId": "engineering"}, "optionalRelation": "manager"}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "resource", "objectId": "promserver"},
        "relation": "viewer",
        "subject": {"object": {"objectType": "user", "objectId": "an_external_user"}}
      }
    },
    {
      "operation": "OPERATION_TOUCH",
      "relationship": {
        "resource": {"objectType": "usergroup", "objectId": "blackhats"},
        "relation": "manager",
        "subject": {"object": {"objectType": "user", "objectId": "a_villain"}}
      }
    }
  ]
}
EOF
echo ""
echo "✅ Relationships written successfully!"

echo ""
echo "🎉 SpiceDB initialization complete!"
echo ""
echo "📋 Mock data summary:"
echo "  - Users: ceo, cto, an_eng_director, an_eng_manager, an_engineer, it_admin, an_external_user, a_villain"
echo "  - Groups: csuite, engineering, applications, productname, blackhats"
echo "  - Organization: org1"
echo "  - Resources: promserver, jira"
echo ""
echo "🧪 Try these example permission checks:"
echo "  - Can 'ceo' admin 'org1'? (should be yes)"
echo "  - Can 'an_engineer' view 'promserver'? (should be yes)"
echo "  - Can 'an_external_user' manage 'promserver'? (should be no)"
