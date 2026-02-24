// Deployed as a separate module AFTER the PostgreSQL server is fully provisioned.
// During re-provisioning, the server enters an "Updating" state and rejects
// Entra ID admin operations until it is accessible again. Splitting this into
// its own module ensures the server is stable before we touch the AD admin.

@description('Name of the existing PostgreSQL Flexible Server')
param serverName string

@description('Object ID of the App Service managed identity')
param appServicePrincipalId string

@description('Display name for the Entra ID admin (e.g., the App Service name)')
param entraAdminName string

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' existing = {
  name: serverName
}

resource entraAdmin 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2024-08-01' = {
  parent: postgresServer
  name: appServicePrincipalId
  properties: {
    principalName: entraAdminName
    principalType: 'ServicePrincipal'
    tenantId: subscription().tenantId
  }
}
