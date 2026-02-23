@description('Location for all resources')
param location string

@description('Tags for all resources')
param tags object

@description('Name of the PostgreSQL Flexible Server')
param serverName string

@description('Name of the database')
param databaseName string

@description('Administrator login name')
param administratorLogin string

@secure()
@description('Administrator password')
param administratorPassword string

@description('PostgreSQL SKU name')
param skuName string

@description('Storage size in GB')
param storageSizeGB int

@description('Object ID of the App Service managed identity (for Entra ID auth)')
param appServicePrincipalId string

@description('Display name for the Entra ID admin (e.g., the App Service name)')
param entraAdminName string

// PostgreSQL Flexible Server
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    version: '16'
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Enabled' // Keep password auth for admin maintenance
    }
    storage: {
      storageSizeGB: storageSizeGB
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// Add App Service managed identity as Entra ID admin
resource entraAdmin 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2024-08-01' = {
  parent: postgresServer
  name: appServicePrincipalId
  properties: {
    principalName: entraAdminName
    principalType: 'ServicePrincipal'
    tenantId: subscription().tenantId
  }
}

// Firewall rule: Allow Azure services
resource firewallRuleAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Database
resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgresServer
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

output serverFqdn string = postgresServer.properties.fullyQualifiedDomainName
