@description('Location for all resources')
param location string

@description('Tags for all resources')
param tags object

@description('Name of the Key Vault')
param keyVaultName string

// Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2024-04-01-preview' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

// Auto-generate a cron secret and store it in the vault.
// @onlyIfNotExists ensures the secret is created once and never overwritten.
@onlyIfNotExists()
resource cronSecretEntry 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = {
  parent: keyVault
  name: 'cron-secret'
  properties: {
    value: uniqueString(keyVault.id, 'cron-secret', subscription().subscriptionId)
  }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output cronSecretUri string = cronSecretEntry.properties.secretUri
