@description('Name of the Key Vault to grant access to')
param keyVaultName string

@description('Principal IDs that should get Key Vault Secrets User role (read secrets)')
param principalIds array

// Reference the existing Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2024-04-01-preview' existing = {
  name: keyVaultName
}

// Key Vault Secrets User — allows reading secret values
// Role definition ID: 4633458b-17de-408a-b874-0445c86b69e6
var keyVaultSecretsUserRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')

@batchSize(1)
resource secretReaderRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for (principalId, i) in principalIds: {
    scope: keyVault
    name: guid(keyVault.id, principalId, keyVaultSecretsUserRoleId)
    properties: {
      roleDefinitionId: keyVaultSecretsUserRoleId
      principalId: principalId
      principalType: 'ServicePrincipal'
    }
  }
]
