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

@description('Football Data API Key')
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
  }
}

// Outputs used by azd
output AZURE_LOCATION string = location
output SERVICE_WEB_NAME string = web.outputs.appServiceName
output SERVICE_WEB_URI string = web.outputs.appServiceUri
output DATABASE_HOST string = 'psql-${resourceToken}.postgres.database.azure.com'
