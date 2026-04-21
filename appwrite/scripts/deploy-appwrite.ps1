param(
  [switch]$SkipCollections
)

$ErrorActionPreference = "Stop"

function Read-DotEnv {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $values = @{}

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $parts = $trimmed -split "=", 2
    if ($parts.Count -ne 2) {
      continue
    }

    $values[$parts[0].Trim()] = $parts[1].Trim()
  }

  return $values
}

function New-AppwriteHeaders {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$EnvMap
  )

  return @{
    "X-Appwrite-Project" = $EnvMap.APPWRITE_PROJECT_ID
    "X-Appwrite-Key" = $EnvMap.APPWRITE_API_KEY
    "Content-Type" = "application/json"
  }
}

function Invoke-Appwrite {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("GET", "POST", "PUT", "PATCH", "DELETE")]
    [string]$Method,

    [Parameter(Mandatory = $true)]
    [string]$Uri,

    [Parameter(Mandatory = $true)]
    [hashtable]$Headers,

    [object]$Body
  )

  $params = @{
    Method = $Method
    Uri = $Uri
    Headers = $Headers
  }

  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
  }

  try {
    return Invoke-RestMethod @params
  } catch {
    if ($_.Exception.Response) {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $reader.BaseStream.Position = 0
      $reader.DiscardBufferedData()
      $responseBody = $reader.ReadToEnd()
      throw "Appwrite API $Method $Uri failed: $responseBody"
    }

    throw
  }
}

function Remove-NullProperties {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$InputObject
  )

  $clean = @{}
  foreach ($key in $InputObject.Keys) {
    if ($null -ne $InputObject[$key]) {
      $clean[$key] = $InputObject[$key]
    }
  }

  return $clean
}

function Wait-ForAttribute {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUri,

    [Parameter(Mandatory = $true)]
    [hashtable]$Headers,

    [Parameter(Mandatory = $true)]
    [string]$DatabaseId,

    [Parameter(Mandatory = $true)]
    [string]$CollectionId,

    [Parameter(Mandatory = $true)]
    [string]$Key
  )

  for ($attempt = 0; $attempt -lt 240; $attempt++) {
    $attribute = $null
    try {
      $attribute = Invoke-Appwrite -Method GET -Uri "$BaseUri/databases/$DatabaseId/collections/$CollectionId/attributes/$Key" -Headers $Headers
    } catch {
      if ($_.Exception.Message -notmatch "attribute_not_found") {
        throw
      }
    }

    if ($null -ne $attribute) {
      if ($attribute.status -eq "available") {
        return
      }

      if ($attribute.status -eq "failed" -or $attribute.status -eq "stuck") {
        throw "Attribute '$Key' on collection '$CollectionId' is in status '$($attribute.status)': $($attribute.error)"
      }
    }

    Start-Sleep -Seconds 2
  }

  throw "Timed out waiting for attribute '$Key' on collection '$CollectionId'."
}

function Wait-ForIndex {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUri,

    [Parameter(Mandatory = $true)]
    [hashtable]$Headers,

    [Parameter(Mandatory = $true)]
    [string]$DatabaseId,

    [Parameter(Mandatory = $true)]
    [string]$CollectionId,

    [Parameter(Mandatory = $true)]
    [string]$Key
  )

  for ($attempt = 0; $attempt -lt 240; $attempt++) {
    $indexes = Invoke-Appwrite -Method GET -Uri "$BaseUri/databases/$DatabaseId/collections/$CollectionId/indexes" -Headers $Headers
    $index = $indexes.indexes | Where-Object { $_.key -eq $Key } | Select-Object -First 1

    if ($null -ne $index) {
      if ($index.status -eq "available") {
        return
      }

      if ($index.status -eq "failed" -or $index.status -eq "stuck") {
        throw "Index '$Key' on collection '$CollectionId' is in status '$($index.status)': $($index.error)"
      }
    }

    Start-Sleep -Seconds 2
  }

  throw "Timed out waiting for index '$Key' on collection '$CollectionId'."
}

function Ensure-Attribute {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUri,

    [Parameter(Mandatory = $true)]
    [hashtable]$Headers,

    [Parameter(Mandatory = $true)]
    [string]$DatabaseId,

    [Parameter(Mandatory = $true)]
    [string]$CollectionId,

    [Parameter(Mandatory = $true)]
    [hashtable]$Spec
  )

  $attribute = $null
  try {
    $attribute = Invoke-Appwrite -Method GET -Uri "$BaseUri/databases/$DatabaseId/collections/$CollectionId/attributes/$($Spec.key)" -Headers $Headers
  } catch {
    if ($_.Exception.Message -notmatch "attribute_not_found") {
      throw
    }
  }

  if ($null -ne $attribute) {
    if ($attribute.status -ne "available") {
      Wait-ForAttribute -BaseUri $BaseUri -Headers $Headers -DatabaseId $DatabaseId -CollectionId $CollectionId -Key $Spec.key
    }
    return
  }

  $body = @{
    key = $Spec.key
    required = [bool]$Spec.required
    array = [bool]$Spec.array
  }

  $defaultValue = $Spec.default
  if ([bool]$Spec.required) {
    $defaultValue = $null
  }

  switch ($Spec.type) {
    "string" {
      $body.size = $Spec.size
      $body.default = $defaultValue
      $endpoint = "string"
    }
    "email" {
      $body.default = $defaultValue
      $endpoint = "email"
    }
    "integer" {
      $body.min = $Spec.min
      $body.max = $Spec.max
      $body.default = $defaultValue
      $endpoint = "integer"
    }
    "float" {
      $body.min = $Spec.min
      $body.max = $Spec.max
      $body.default = $defaultValue
      $endpoint = "float"
    }
    "boolean" {
      $body.default = $defaultValue
      $endpoint = "boolean"
    }
    "datetime" {
      $body.default = $defaultValue
      $endpoint = "datetime"
    }
    "enum" {
      $body.elements = $Spec.elements
      $body.default = $defaultValue
      $endpoint = "enum"
    }
    default {
      throw "Unsupported attribute type '$($Spec.type)' for key '$($Spec.key)'."
    }
  }

  try {
    Invoke-Appwrite `
      -Method POST `
      -Uri "$BaseUri/databases/$DatabaseId/collections/$CollectionId/attributes/$endpoint" `
      -Headers $Headers `
      -Body (Remove-NullProperties -InputObject $body) | Out-Null
  } catch {
    if ($_.Exception.Message -notmatch "attribute_already_exists") {
      throw
    }
  }

  Wait-ForAttribute -BaseUri $BaseUri -Headers $Headers -DatabaseId $DatabaseId -CollectionId $CollectionId -Key $Spec.key
}

function Ensure-Index {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUri,

    [Parameter(Mandatory = $true)]
    [hashtable]$Headers,

    [Parameter(Mandatory = $true)]
    [string]$DatabaseId,

    [Parameter(Mandatory = $true)]
    [string]$CollectionId,

    [Parameter(Mandatory = $true)]
    [hashtable]$Spec
  )

  $existing = Invoke-Appwrite -Method GET -Uri "$BaseUri/databases/$DatabaseId/collections/$CollectionId/indexes" -Headers $Headers
  $index = $existing.indexes | Where-Object { $_.key -eq $Spec.key } | Select-Object -First 1

  if ($null -ne $index) {
    if ($index.status -ne "available") {
      Wait-ForIndex -BaseUri $BaseUri -Headers $Headers -DatabaseId $DatabaseId -CollectionId $CollectionId -Key $Spec.key
    }
    return
  }

  try {
    Invoke-Appwrite `
      -Method POST `
      -Uri "$BaseUri/databases/$DatabaseId/collections/$CollectionId/indexes" `
      -Headers $Headers `
      -Body @{
        key = $Spec.key
        type = $Spec.type
        attributes = $Spec.attributes
        orders = $Spec.orders
      } | Out-Null
  } catch {
    if ($_.Exception.Message -notmatch "index_already_exists") {
      throw
    }
  }

  Wait-ForIndex -BaseUri $BaseUri -Headers $Headers -DatabaseId $DatabaseId -CollectionId $CollectionId -Key $Spec.key
}

function Ensure-Collection {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUri,

    [Parameter(Mandatory = $true)]
    [hashtable]$Headers,

    [Parameter(Mandatory = $true)]
    [string]$DatabaseId,

    [Parameter(Mandatory = $true)]
    [hashtable]$Spec
  )

  $collectionsResponse = Invoke-Appwrite -Method GET -Uri "$BaseUri/databases/$DatabaseId/collections" -Headers $Headers
  $collection = $collectionsResponse.collections | Where-Object { $_.'$id' -eq $Spec.id -or $_.name -eq $Spec.name } | Select-Object -First 1

  if ($null -eq $collection) {
    $collection = Invoke-Appwrite `
      -Method POST `
      -Uri "$BaseUri/databases/$DatabaseId/collections" `
      -Headers $Headers `
      -Body @{
        collectionId = $Spec.id
        name = $Spec.name
        permissions = @()
        documentSecurity = $false
        enabled = $true
      }
  }

  foreach ($attribute in $Spec.attributes) {
    Ensure-Attribute -BaseUri $BaseUri -Headers $Headers -DatabaseId $DatabaseId -CollectionId $collection.'$id' -Spec $attribute
  }

  foreach ($index in $Spec.indexes) {
    Ensure-Index -BaseUri $BaseUri -Headers $Headers -DatabaseId $DatabaseId -CollectionId $collection.'$id' -Spec $index
  }

  return $collection.'$id'
}

function Sync-CollectionIdsToEnv {
  param(
    [Parameter(Mandatory = $true)]
    [string]$EnvPath,

    [Parameter(Mandatory = $true)]
    [hashtable]$CollectionIds
  )

  $lines = Get-Content -LiteralPath $EnvPath
  $updated = foreach ($line in $lines) {
    if ($line -match "^APPWRITE_USERS_COLLECTION_ID=") {
      "APPWRITE_USERS_COLLECTION_ID=$($CollectionIds.users)"
    } elseif ($line -match "^APPWRITE_PRODUCTS_COLLECTION_ID=") {
      "APPWRITE_PRODUCTS_COLLECTION_ID=$($CollectionIds.products)"
    } elseif ($line -match "^APPWRITE_VENDORS_COLLECTION_ID=") {
      "APPWRITE_VENDORS_COLLECTION_ID=$($CollectionIds.vendors)"
    } elseif ($line -match "^APPWRITE_PAYMENTS_COLLECTION_ID=") {
      "APPWRITE_PAYMENTS_COLLECTION_ID=$($CollectionIds.payments)"
    } elseif ($line -match "^APPWRITE_CATEGORIES_COLLECTION_ID=") {
      "APPWRITE_CATEGORIES_COLLECTION_ID=$($CollectionIds.categories)"
    } else {
      $line
    }
  }

  Set-Content -LiteralPath $EnvPath -Value $updated
}

function Stage-Functions {
  param(
    [Parameter(Mandatory = $true)]
    [string]$AppwriteRoot,

    [Parameter(Mandatory = $true)]
    [string]$StageRoot,

    [Parameter(Mandatory = $true)]
    [string[]]$FunctionNames
  )

  if (Test-Path -LiteralPath $StageRoot) {
    Remove-Item -LiteralPath $StageRoot -Recurse -Force
  }

  New-Item -ItemType Directory -Path $StageRoot | Out-Null

  $sharedSource = Join-Path $AppwriteRoot "functions\\shared"

  foreach ($functionName in $FunctionNames) {
    $source = Join-Path $AppwriteRoot "functions\\$functionName"
    $target = Join-Path $StageRoot $functionName

    Copy-Item -LiteralPath $source -Destination $target -Recurse
    Copy-Item -LiteralPath $sharedSource -Destination (Join-Path $target "shared") -Recurse

    $packagePath = Join-Path $target "package.json"
    $packageJson = Get-Content -Raw -LiteralPath $packagePath | ConvertFrom-Json
    $packageJson.dependencies."@migration/shared" = "file:./shared"
    $packageJson | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $packagePath
  }
}

function Write-AppwriteConfig {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ConfigPath,

    [Parameter(Mandatory = $true)]
    [hashtable]$EnvMap,

    [Parameter(Mandatory = $true)]
    [string[]]$FunctionNames
  )

  $functions = foreach ($functionName in $FunctionNames) {
    @{
      '$id' = $functionName
      name = $functionName
      runtime = "node-25"
      entrypoint = "src/main.js"
      commands = "npm install"
      enabled = $true
      logging = $true
      execute = @("any")
      events = @()
      schedule = ""
      timeout = 15
      path = ".deploy/$functionName"
    }
  }

  $config = @{
    projectId = $EnvMap.APPWRITE_PROJECT_ID
    endpoint = $EnvMap.APPWRITE_ENDPOINT
    functions = @($functions)
  }

  $config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ConfigPath
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$appwriteRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptRoot ".."))
$envPath = Join-Path $appwriteRoot ".env"
$configPath = Join-Path $appwriteRoot "appwrite.config.json"
$stageRoot = Join-Path $appwriteRoot ".deploy"

$envMap = Read-DotEnv -Path $envPath
$requiredKeys = @(
  "APPWRITE_ENDPOINT",
  "APPWRITE_PROJECT_ID",
  "APPWRITE_API_KEY",
  "APPWRITE_DATABASE_ID"
)

foreach ($key in $requiredKeys) {
  if (-not $envMap.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envMap[$key])) {
    throw "Missing required key '$key' in $envPath"
  }
}

$headers = New-AppwriteHeaders -EnvMap $envMap
$baseUri = $envMap.APPWRITE_ENDPOINT.TrimEnd("/")
$databaseId = $envMap.APPWRITE_DATABASE_ID

$collections = @(
  @{
    id = "users"
    name = "users"
    envKey = "users"
    attributes = @(
      @{ key = "mongoId"; type = "string"; size = 24; required = $true; array = $false; default = $null }
      @{ key = "email"; type = "email"; required = $true; array = $false; default = $null }
      @{ key = "passwordHash"; type = "string"; size = 255; required = $true; array = $false; default = $null }
      @{ key = "role"; type = "enum"; elements = @("super_admin", "admin", "vendor"); required = $true; array = $false; default = "vendor" }
      @{ key = "status"; type = "enum"; elements = @("active", "suspended"); required = $true; array = $false; default = "active" }
      @{ key = "profileFirstName"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "profileLastName"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "profilePhone"; type = "string"; size = 50; required = $false; array = $false; default = $null }
      @{ key = "profileRegion"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "profileNotes"; type = "string"; size = 2000; required = $false; array = $false; default = $null }
      @{ key = "lastLoginAt"; type = "datetime"; required = $false; array = $false; default = $null }
    )
    indexes = @(
      @{ key = "users_mongoId_unique"; type = "unique"; attributes = @("mongoId"); orders = @("ASC") }
      @{ key = "users_email_unique"; type = "unique"; attributes = @("email"); orders = @("ASC") }
      @{ key = "users_role_key"; type = "key"; attributes = @("role"); orders = @("ASC") }
      @{ key = "users_status_key"; type = "key"; attributes = @("status"); orders = @("ASC") }
    )
  }
  @{
    id = "vendors"
    name = "vendors"
    envKey = "vendors"
    attributes = @(
      @{ key = "mongoId"; type = "string"; size = 24; required = $true; array = $false; default = $null }
      @{ key = "ownerMongoId"; type = "string"; size = 24; required = $true; array = $false; default = $null }
      @{ key = "businessName"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "description"; type = "string"; size = 5000; required = $false; array = $false; default = $null }
      @{ key = "artisanCategory"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "logo"; type = "string"; size = 500; required = $false; array = $false; default = $null }
      @{ key = "logoUrl"; type = "string"; size = 500; required = $false; array = $false; default = $null }
      @{ key = "profilePhotoUrl"; type = "string"; size = 500; required = $false; array = $false; default = $null }
      @{ key = "bannerImage"; type = "string"; size = 500; required = $false; array = $false; default = $null }
      @{ key = "themeColor"; type = "enum"; elements = @("black", "deep_blue", "green", "purple_blue"); required = $true; array = $false; default = "black" }
      @{ key = "phoneNumber"; type = "string"; size = 50; required = $false; array = $false; default = $null }
      @{ key = "whatsappNumber"; type = "string"; size = 50; required = $false; array = $false; default = $null }
      @{ key = "socialsFacebook"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "socialsInstagram"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "socialsX"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "referralCodeUsed"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "status"; type = "enum"; elements = @("pending", "active", "suspended"); required = $true; array = $false; default = "pending" }
      @{ key = "subdomain"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "addressStreet"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "addressCity"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "addressState"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "addressCountry"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "addressPostalCode"; type = "string"; size = 50; required = $false; array = $false; default = $null }
      @{ key = "locationRegion"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "locationArea"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "metaViews"; type = "integer"; required = $true; array = $false; min = 0; max = $null; default = 0 }
      @{ key = "metaFollowers"; type = "integer"; required = $true; array = $false; min = 0; max = $null; default = 0 }
    )
    indexes = @(
      @{ key = "vendors_mongoId_unique"; type = "unique"; attributes = @("mongoId"); orders = @("ASC") }
      @{ key = "vendors_subdomain_unique"; type = "unique"; attributes = @("subdomain"); orders = @("ASC") }
      @{ key = "vendors_owner_status_key"; type = "key"; attributes = @("ownerMongoId", "status"); orders = @("ASC", "ASC") }
      @{ key = "vendors_status_key"; type = "key"; attributes = @("status"); orders = @("ASC") }
    )
  }
  @{
    id = "categories"
    name = "categories"
    envKey = "categories"
    attributes = @(
      @{ key = "mongoId"; type = "string"; size = 24; required = $true; array = $false; default = $null }
      @{ key = "name"; type = "string"; size = 255; required = $true; array = $false; default = $null }
      @{ key = "slug"; type = "string"; size = 255; required = $true; array = $false; default = $null }
      @{ key = "parentMongoId"; type = "string"; size = 24; required = $false; array = $false; default = $null }
      @{ key = "icon"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "createdByMongoId"; type = "string"; size = 24; required = $false; array = $false; default = $null }
      @{ key = "updatedByMongoId"; type = "string"; size = 24; required = $false; array = $false; default = $null }
      @{ key = "status"; type = "enum"; elements = @("active", "inactive"); required = $true; array = $false; default = "active" }
    )
    indexes = @(
      @{ key = "categories_mongoId_unique"; type = "unique"; attributes = @("mongoId"); orders = @("ASC") }
      @{ key = "categories_name_unique"; type = "unique"; attributes = @("name"); orders = @("ASC") }
      @{ key = "categories_slug_unique"; type = "unique"; attributes = @("slug"); orders = @("ASC") }
      @{ key = "categories_status_key"; type = "key"; attributes = @("status"); orders = @("ASC") }
    )
  }
  @{
    id = "products"
    name = "products"
    envKey = "products"
    attributes = @(
      @{ key = "mongoId"; type = "string"; size = 24; required = $true; array = $false; default = $null }
      @{ key = "vendorMongoId"; type = "string"; size = 24; required = $true; array = $false; default = $null }
      @{ key = "name"; type = "string"; size = 255; required = $true; array = $false; default = $null }
      @{ key = "description"; type = "string"; size = 5000; required = $false; array = $false; default = $null }
      @{ key = "categoryMongoId"; type = "string"; size = 24; required = $true; array = $false; default = $null }
      @{ key = "region"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "price"; type = "float"; required = $true; array = $false; min = 0; max = $null; default = 0 }
      @{ key = "discountPrice"; type = "float"; required = $false; array = $false; min = 0; max = $null; default = $null }
      @{ key = "promoStart"; type = "datetime"; required = $false; array = $false; default = $null }
      @{ key = "promoEnd"; type = "datetime"; required = $false; array = $false; default = $null }
      @{ key = "sku"; type = "string"; size = 255; required = $false; array = $false; default = $null }
      @{ key = "stock"; type = "integer"; required = $true; array = $false; min = 0; max = $null; default = 0 }
      @{ key = "images"; type = "string"; size = 2000; required = $false; array = $true; default = $null }
      @{ key = "tags"; type = "string"; size = 255; required = $false; array = $true; default = $null }
      @{ key = "variants"; type = "string"; size = 10000; required = $false; array = $false; default = $null }
      @{ key = "status"; type = "enum"; elements = @("draft", "pending", "approved", "rejected"); required = $true; array = $false; default = "pending" }
      @{ key = "rejectionNote"; type = "string"; size = 2000; required = $false; array = $false; default = $null }
      @{ key = "metaViews"; type = "integer"; required = $true; array = $false; min = 0; max = $null; default = 0 }
      @{ key = "metaSales"; type = "integer"; required = $true; array = $false; min = 0; max = $null; default = 0 }
    )
    indexes = @(
      @{ key = "products_mongoId_unique"; type = "unique"; attributes = @("mongoId"); orders = @("ASC") }
      @{ key = "products_sku_unique"; type = "unique"; attributes = @("sku"); orders = @("ASC") }
      @{ key = "products_vendor_status_key"; type = "key"; attributes = @("vendorMongoId", "status"); orders = @("ASC", "ASC") }
      @{ key = "products_category_status_key"; type = "key"; attributes = @("categoryMongoId", "status"); orders = @("ASC", "ASC") }
      @{ key = "products_price_key"; type = "key"; attributes = @("price"); orders = @("ASC") }
    )
  }
  @{
    id = "payments"
    name = "payments"
    envKey = "payments"
    attributes = @(
      @{ key = "mongoId"; type = "string"; size = 24; required = $true; array = $false; default = $null }
      @{ key = "type"; type = "enum"; elements = @("registration", "order"); required = $true; array = $false; default = "registration" }
      @{ key = "amount"; type = "float"; required = $true; array = $false; min = 0; max = $null; default = 0 }
      @{ key = "currency"; type = "string"; size = 10; required = $true; array = $false; default = "NGN" }
      @{ key = "provider"; type = "enum"; elements = @("paystack"); required = $true; array = $false; default = "paystack" }
      @{ key = "reference"; type = "string"; size = 255; required = $true; array = $false; default = $null }
      @{ key = "status"; type = "enum"; elements = @("pending", "success", "failed"); required = $true; array = $false; default = "pending" }
      @{ key = "userMongoId"; type = "string"; size = 24; required = $false; array = $false; default = $null }
      @{ key = "vendorMongoId"; type = "string"; size = 24; required = $false; array = $false; default = $null }
      @{ key = "metadata"; type = "string"; size = 10000; required = $false; array = $false; default = $null }
      @{ key = "paidAt"; type = "datetime"; required = $false; array = $false; default = $null }
    )
    indexes = @(
      @{ key = "payments_mongoId_unique"; type = "unique"; attributes = @("mongoId"); orders = @("ASC") }
      @{ key = "payments_reference_unique"; type = "unique"; attributes = @("reference"); orders = @("ASC") }
      @{ key = "payments_type_key"; type = "key"; attributes = @("type"); orders = @("ASC") }
      @{ key = "payments_status_key"; type = "key"; attributes = @("status"); orders = @("ASC") }
      @{ key = "payments_user_key"; type = "key"; attributes = @("userMongoId"); orders = @("ASC") }
      @{ key = "payments_vendor_status_key"; type = "key"; attributes = @("vendorMongoId", "status"); orders = @("ASC", "ASC") }
    )
  }
)

$collectionIds = @{}
if (-not $SkipCollections) {
  foreach ($collectionSpec in $collections) {
    $collectionIds[$collectionSpec.envKey] = Ensure-Collection `
      -BaseUri $baseUri `
      -Headers $headers `
      -DatabaseId $databaseId `
      -Spec $collectionSpec
  }

  Sync-CollectionIdsToEnv -EnvPath $envPath -CollectionIds $collectionIds
}

$functionNames = @(
  "gateway-function"
)

Stage-Functions -AppwriteRoot $appwriteRoot -StageRoot $stageRoot -FunctionNames $functionNames
Write-AppwriteConfig -ConfigPath $configPath -EnvMap $envMap -FunctionNames $functionNames

if (-not $SkipCollections) {
  Write-Host "Collections synchronized:"
  foreach ($name in $collectionIds.Keys | Sort-Object) {
    Write-Host " - $name => $($collectionIds[$name])"
  }
}

Write-Host "Generated:"
Write-Host " - $configPath"
Write-Host " - $stageRoot"
