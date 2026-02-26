targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment (e.g., dev, staging, prod)')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

// Minimum B2 — the B1 SKU (1.75 GB RAM) is not enough for Oryx remote build
// (npm install + next build). The process gets OOM-killed during deployment.
@description('Name of the App Service Plan SKU')
param appServicePlanSkuName string = 'B2'

@description('PostgreSQL administrator login name')
param postgresAdminLogin string = 'sportpredadmin'

@secure()
@description('PostgreSQL administrator password')
param postgresAdminPassword string

@description('PostgreSQL SKU name')
param postgresSkuName string = 'Standard_B1ms'

@description('PostgreSQL storage size in GB')
param postgresStorageSizeGB int = 32

@secure()
@description('Auth.js session secret')
param authSecret string = ''

@description('Google OAuth Client ID')
param authGoogleId string = ''

@secure()
@description('Google OAuth Client Secret')
param authGoogleSecret string = ''

@description('GitHub OAuth App Client ID')
param authGithubId string = ''

@secure()
@description('GitHub OAuth App Client Secret')
param authGithubSecret string = ''

@description('Microsoft Entra ID Client ID (from app registration)')
param authMicrosoftEntraIdId string = ''

@secure()
@description('Microsoft Entra ID Client Secret')
param authMicrosoftEntraIdSecret string = ''

@description('Microsoft Entra ID Issuer URL (optional, for single-tenant)')
param authMicrosoftEntraIdIssuer string = ''

@description('API-Football API Key')
param footballApiKey string = ''

// Tags for all resources
var tags = {
  'azd-env-name': environmentName
  project: 'sport-predictor'
}

// Generate a unique suffix based on resource group ID
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))

// Resource group
resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

// Separate resource group for Azure Functions (Consumption plan).
// Linux Dynamic (Y1) and Linux Dedicated workers cannot coexist in the same
// resource group, so the Function App gets its own RG.
resource rgFunctions 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-${environmentName}-functions'
  location: location
  tags: tags
}

// Log Analytics Workspace + Application Insights
module monitoring 'core/monitor/appinsights.bicep' = {
  name: 'monitoring'
  scope: rg
  params: {
    location: location
    tags: tags
    logAnalyticsWorkspaceName: 'log-${resourceToken}'
    applicationInsightsName: 'appi-${resourceToken}'
  }
}

// Storage Account (for blob storage — avatars, static assets)
module storage 'core/storage/storage.bicep' = {
  name: 'storage'
  scope: rg
  params: {
    location: location
    tags: tags
    storageAccountName: 'st${resourceToken}'
  }
}

// Key Vault — auto-generates and stores shared secrets (e.g. CRON_SECRET)
module keyVault 'core/security/keyvault.bicep' = {
  name: 'keyvault'
  scope: rg
  params: {
    location: location
    tags: tags
    keyVaultName: 'kv-${resourceToken}'
  }
}

// Grant both the Web App and Function App read access to Key Vault secrets.
// Deployed after all three resources exist to avoid circular dependencies.
module keyVaultAccess 'core/security/keyvault-access.bicep' = {
  name: 'keyvaultAccess'
  scope: rg
  params: {
    keyVaultName: 'kv-${resourceToken}'
    principalIds: [
      web.outputs.appServicePrincipalId
      functions.outputs.functionAppPrincipalId
    ]
  }
}

// PostgreSQL Flexible Server
module database 'core/database/postgresql.bicep' = {
  name: 'database'
  scope: rg
  params: {
    location: location
    tags: tags
    serverName: 'psql-${resourceToken}'
    databaseName: 'sport_predictor'
    administratorLogin: postgresAdminLogin
    administratorPassword: postgresAdminPassword
    skuName: postgresSkuName
    storageSizeGB: postgresStorageSizeGB
  }
}

// Entra ID admin for PostgreSQL — deployed as a separate module so the server
// is fully stable before we add the AD admin (avoids "not accessible" errors
// during re-provisioning).
module databaseEntraAdmin 'core/database/postgresql-entra-admin.bicep' = {
  name: 'databaseEntraAdmin'
  scope: rg
  dependsOn: [
    database
  ]
  params: {
    serverName: 'psql-${resourceToken}'
    appServicePrincipalId: web.outputs.appServicePrincipalId
    entraAdminName: 'app-${resourceToken}'
  }
}

// App Service Plan + Web App
module web 'app/web.bicep' = {
  name: 'web'
  scope: rg
  params: {
    location: location
    tags: tags
    appServicePlanName: 'plan-${resourceToken}'
    appServiceName: 'app-${resourceToken}'
    appServicePlanSkuName: appServicePlanSkuName
    applicationInsightsConnectionString: monitoring.outputs.applicationInsightsConnectionString
    postgresHost: 'psql-${resourceToken}.postgres.database.azure.com'
    postgresDatabaseName: 'sport_predictor'
    storageAccountName: storage.outputs.storageAccountName
    authSecret: authSecret
    authGoogleId: authGoogleId
    authGoogleSecret: authGoogleSecret
    authGithubId: authGithubId
    authGithubSecret: authGithubSecret
    authMicrosoftEntraIdId: authMicrosoftEntraIdId
    authMicrosoftEntraIdSecret: authMicrosoftEntraIdSecret
    authMicrosoftEntraIdIssuer: authMicrosoftEntraIdIssuer
    footballApiKey: footballApiKey
    cronKvRef: keyVault.outputs.cronSecretUri
  }
}

// Storage Account for Azure Functions runtime (in the functions resource group)
module functionsStorage 'core/storage/storage.bicep' = {
  name: 'functionsStorage'
  scope: rgFunctions
  params: {
    location: location
    tags: tags
    storageAccountName: 'stfunc${resourceToken}'
  }
}

// Azure Functions — timer-triggered live sync (Flex Consumption plan).
// Deployed to a separate resource group for isolation.
module functions 'core/host/function.bicep' = {
  name: 'functions'
  scope: rgFunctions
  params: {
    location: location
    tags: tags
    functionAppName: 'func-${resourceToken}'
    functionPlanName: 'plan-func-${resourceToken}'
    storageAccountName: functionsStorage.outputs.storageAccountName
    applicationInsightsConnectionString: monitoring.outputs.applicationInsightsConnectionString
    cronTargetUrl: web.outputs.appServiceUri
    cronKvRef: keyVault.outputs.cronSecretUri
  }
}

// Outputs used by azd
output AZURE_LOCATION string = location
output SERVICE_WEB_NAME string = web.outputs.appServiceName
output SERVICE_WEB_URI string = web.outputs.appServiceUri
output SERVICE_WEB_RESOURCE_GROUP string = rg.name
output SERVICE_FUNCTIONS_NAME string = functions.outputs.functionAppName
output SERVICE_FUNCTIONS_RESOURCE_GROUP string = rgFunctions.name
output DATABASE_HOST string = 'psql-${resourceToken}.postgres.database.azure.com'
output KEY_VAULT_NAME string = keyVault.outputs.keyVaultName
