$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $repoRoot 'clasp.projects.json'

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "Missing config file: $configPath"
}

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json

foreach ($projectName in @('core', 'provisioner', 'frontend')) {
  $projectDir = Join-Path $repoRoot $projectName
  if (-not (Test-Path -LiteralPath $projectDir)) {
    New-Item -ItemType Directory -Path $projectDir | Out-Null
  }

  $binding = [ordered]@{
    scriptId = $config.projects.$projectName.scriptId
    rootDir = ''
    scriptExtensions = @('.js', '.gs')
    htmlExtensions = @('.html')
    jsonExtensions = @('.json')
    filePushOrder = @()
    skipSubdirectories = $false
  }

  $bindingPath = Join-Path $projectDir '.clasp.json'
  $binding | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $bindingPath -Encoding UTF8
  "Bound $projectName -> $($config.projects.$projectName.scriptId)"
}
