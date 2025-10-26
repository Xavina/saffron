# Initialize SpiceDB with schema and mock data
# Usage: .\init-spicedb.ps1

$ErrorActionPreference = "Stop"

$SPICEDB_ENDPOINT = "localhost:8443"
$PRESHARED_KEY = "saffron-dev-key"

Write-Host "🚀 Initializing SpiceDB with mock data..." -ForegroundColor Cyan

# Wait for SpiceDB to be ready
Write-Host "⏳ Waiting for SpiceDB to be ready..." -ForegroundColor Yellow
$ready = $false
while (-not $ready) {
    try {
        $headers = @{
            "Authorization" = "Bearer $PRESHARED_KEY"
            "Content-Type" = "application/json"
        }
        $response = Invoke-WebRequest -Uri "http://$SPICEDB_ENDPOINT/v1/schema/read" -Headers $headers -Method POST -Body "{}" -UseBasicParsing -ErrorAction SilentlyContinue
        $ready = $true
    }
    catch {
        Write-Host "  Waiting for SpiceDB..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}
Write-Host "✅ SpiceDB is ready!" -ForegroundColor Green

# Write the schema
Write-Host "📝 Writing schema..." -ForegroundColor Yellow
$schemaBody = @{
    schema = "definition user {}`n`ndefinition resource {`n    relation manager: user | usergroup#member | usergroup#manager`n    relation viewer: user | usergroup#member | usergroup#manager`n    permission manage = manager`n    permission view = viewer + manager`n}`n`ndefinition usergroup {`n    relation manager: user | usergroup#member | usergroup#manager`n    relation direct_member: user | usergroup#member | usergroup#manager`n    permission member = direct_member + manager`n}`n`ndefinition organization {`n    relation group: usergroup`n    relation administrator: user | usergroup#member | usergroup#manager`n    relation direct_member: user`n    relation resource: resource`n    permission admin = administrator`n    permission member = direct_member + administrator + group->member`n}"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $PRESHARED_KEY"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "http://$SPICEDB_ENDPOINT/v1/schema/write" -Method POST -Headers $headers -Body $schemaBody | Out-Null
Write-Host "✅ Schema written successfully!" -ForegroundColor Green

# Write relationships
Write-Host "📊 Writing relationships..." -ForegroundColor Yellow

$relationshipsBody = @{
    updates = @(
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "usergroup"; objectId = "productname"}
                relation = "manager"
                subject = @{object = @{objectType = "user"; objectId = "an_eng_manager"}}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "usergroup"; objectId = "productname"}
                relation = "direct_member"
                subject = @{object = @{objectType = "user"; objectId = "an_engineer"}}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "usergroup"; objectId = "applications"}
                relation = "manager"
                subject = @{object = @{objectType = "user"; objectId = "an_eng_director"}}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "usergroup"; objectId = "engineering"}
                relation = "manager"
                subject = @{object = @{objectType = "user"; objectId = "cto"}}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "usergroup"; objectId = "csuite"}
                relation = "manager"
                subject = @{object = @{objectType = "user"; objectId = "ceo"}}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "usergroup"; objectId = "csuite"}
                relation = "direct_member"
                subject = @{object = @{objectType = "user"; objectId = "cto"}}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "usergroup"; objectId = "engineering"}
                relation = "direct_member"
                subject = @{object = @{objectType = "usergroup"; objectId = "applications"}; optionalRelation = "member"}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "usergroup"; objectId = "applications"}
                relation = "direct_member"
                subject = @{object = @{objectType = "usergroup"; objectId = "productname"}; optionalRelation = "member"}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "usergroup"; objectId = "engineering"}
                relation = "direct_member"
                subject = @{object = @{objectType = "usergroup"; objectId = "csuite"}; optionalRelation = "member"}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "organization"; objectId = "org1"}
                relation = "group"
                subject = @{object = @{objectType = "usergroup"; objectId = "csuite"}}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "organization"; objectId = "org1"}
                relation = "group"
                subject = @{object = @{objectType = "usergroup"; objectId = "productname"}}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "organization"; objectId = "org1"}
                relation = "group"
                subject = @{object = @{objectType = "usergroup"; objectId = "applications"}}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "organization"; objectId = "org1"}
                relation = "group"
                subject = @{object = @{objectType = "usergroup"; objectId = "engineering"}}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "organization"; objectId = "org1"}
                relation = "resource"
                subject = @{object = @{objectType = "resource"; objectId = "promserver"}}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "organization"; objectId = "org1"}
                relation = "resource"
                subject = @{object = @{objectType = "resource"; objectId = "jira"}}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "organization"; objectId = "org1"}
                relation = "administrator"
                subject = @{object = @{objectType = "usergroup"; objectId = "csuite"}; optionalRelation = "member"}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "organization"; objectId = "org1"}
                relation = "administrator"
                subject = @{object = @{objectType = "user"; objectId = "it_admin"}}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "resource"; objectId = "promserver"}
                relation = "manager"
                subject = @{object = @{objectType = "usergroup"; objectId = "productname"}; optionalRelation = "member"}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "resource"; objectId = "promserver"}
                relation = "viewer"
                subject = @{object = @{objectType = "usergroup"; objectId = "engineering"}; optionalRelation = "member"}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "resource"; objectId = "jira"}
                relation = "viewer"
                subject = @{object = @{objectType = "usergroup"; objectId = "engineering"}; optionalRelation = "member"}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "resource"; objectId = "jira"}
                relation = "manager"
                subject = @{object = @{objectType = "usergroup"; objectId = "engineering"}; optionalRelation = "manager"}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "resource"; objectId = "promserver"}
                relation = "viewer"
                subject = @{object = @{objectType = "user"; objectId = "an_external_user"}}
            }
        },
        @{
            operation = "OPERATION_TOUCH"
            relationship = @{
                resource = @{objectType = "usergroup"; objectId = "blackhats"}
                relation = "manager"
                subject = @{object = @{objectType = "user"; objectId = "a_villain"}}
            }
        }
    )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://$SPICEDB_ENDPOINT/v1/relationships/write" -Method POST -Headers $headers -Body $relationshipsBody | Out-Null
Write-Host "✅ Relationships written successfully!" -ForegroundColor Green

Write-Host ""
Write-Host "SpiceDB initialization complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Mock data summary:" -ForegroundColor White
Write-Host "  - Users: ceo, cto, an_eng_director, an_eng_manager, an_engineer, it_admin, an_external_user, a_villain"
Write-Host "  - Groups: csuite, engineering, applications, productname, blackhats"
Write-Host "  - Organization: org1"
Write-Host "  - Resources: promserver, jira"
