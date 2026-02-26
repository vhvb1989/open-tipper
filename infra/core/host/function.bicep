@description('Location for all resources')
param location string

@description('Tags for all resources')
param tags object

@description('Name of the Function App')
param functionAppName string

@description('Name of the App Service Plan for the Function App (Flex Consumption)')
param functionPlanName string

@description('Name of the Storage Account for Function App runtime')
param storageAccountName string

@description('Application Insights connection string')
param applicationInsightsConnectionString string

@description('The web app URL that the timer function will call')
param cronTargetUrl string

@secure()
@description('Shared secret for authenticating cron requests')
param cronSecret string = ''

// Storage account (must be declared before the function app references it)
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

// Blob service + deployment container required by Flex Consumption
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' existing = {
  parent: storageAccount
  name: 'default'
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'deploymentpackages'
  properties: {
    publicAccess: 'None'
  }
}

// Flex Consumption plan (serverless — near-zero cost)
resource functionPlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: functionPlanName
  location: location
  tags: tags
  kind: 'functionapp,linux'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true // Linux
  }
}

// Function App (Flex Consumption)
resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: functionAppName
  location: location
  tags: union(tags, {
    'azd-service-name': 'functions'
  })
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: functionPlan.id
    httpsOnly: true
    functionAppConfig: {
      runtime: {
        name: 'node'
        version: '22'
      }
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storageAccount.properties.primaryEndpoints.blob}deploymentpackages'
          authentication: {
            type: 'StorageAccountConnectionString'
            storageAccountConnectionStringName: 'DEPLOYMENT_STORAGE_CONNECTION_STRING'
          }
        }
      }
    }
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'DEPLOYMENT_STORAGE_CONNECTION_STRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsightsConnectionString
        }
        {
          name: 'CRON_TARGET_URL'
          value: cronTargetUrl
        }
        {
          name: 'CRON_SECRET'
          value: cronSecret
        }
      ]
    }
  }
}

output functionAppName string = functionApp.name
output functionAppUri string = 'https://${functionApp.properties.defaultHostName}'
