@description('Location for all resources')
param location string

@description('Tags for all resources')
param tags object

@description('Name of the App Service Plan')
param appServicePlanName string

@description('Name of the App Service')
param appServiceName string

@description('App Service Plan SKU name')
param appServicePlanSkuName string

@description('Application Insights connection string')
param applicationInsightsConnectionString string

@description('Database connection string (without password)')
param databaseUrl string

@secure()
@description('PostgreSQL admin password')
param postgresAdminPassword string

@description('Storage account name')
param storageAccountName string

@description('Auth.js session secret')
@secure()
param authSecret string

@description('Google OAuth Client ID')
param authGoogleId string

@secure()
@description('Google OAuth Client Secret')
param authGoogleSecret string

@description('GitHub OAuth App Client ID')
param authGithubId string

@secure()
@description('GitHub OAuth App Client Secret')
param authGithubSecret string

@description('Microsoft Entra ID Client ID')
param authMicrosoftEntraIdId string

@secure()
@description('Microsoft Entra ID Client Secret')
param authMicrosoftEntraIdSecret string

@description('Microsoft Entra ID Issuer URL (optional, for single-tenant)')
param authMicrosoftEntraIdIssuer string

@description('Football Data API Key')
param footballApiKey string

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  sku: {
    name: appServicePlanSkuName
  }
  kind: 'linux'
  properties: {
    reserved: true // Required for Linux
  }
}

// App Service (Web App)
resource appService 'Microsoft.Web/sites@2024-04-01' = {
  name: appServiceName
  location: location
  tags: union(tags, {
    'azd-service-name': 'web'
  })
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appCommandLine: 'npm run start'
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsightsConnectionString
        }
        {
          name: 'DATABASE_URL'
          value: '${databaseUrl}${postgresAdminPassword}'
        }
        {
          name: 'AUTH_SECRET'
          value: authSecret
        }
        {
          name: 'AUTH_GOOGLE_ID'
          value: authGoogleId
        }
        {
          name: 'AUTH_GOOGLE_SECRET'
          value: authGoogleSecret
        }
        {
          name: 'AUTH_GITHUB_ID'
          value: authGithubId
        }
        {
          name: 'AUTH_GITHUB_SECRET'
          value: authGithubSecret
        }
        {
          name: 'AUTH_MICROSOFT_ENTRA_ID_ID'
          value: authMicrosoftEntraIdId
        }
        {
          name: 'AUTH_MICROSOFT_ENTRA_ID_SECRET'
          value: authMicrosoftEntraIdSecret
        }
        {
          name: 'AUTH_MICROSOFT_ENTRA_ID_ISSUER'
          value: authMicrosoftEntraIdIssuer
        }
        {
          name: 'FOOTBALL_API_KEY'
          value: footballApiKey
        }
        {
          name: 'AZURE_STORAGE_ACCOUNT_NAME'
          value: storageAccountName
        }
        {
          name: 'NEXT_PUBLIC_APP_URL'
          value: 'https://${appServiceName}.azurewebsites.net'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~22'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
      ]
    }
    httpsOnly: true
  }
}

output appServiceName string = appService.name
output appServiceUri string = 'https://${appService.properties.defaultHostName}'
