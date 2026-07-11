$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot

foreach ($projectName in @('core', 'provisioner', 'frontend')) {
  $projectDir = Join-Path $repoRoot $projectName
  if (-not (Test-Path -LiteralPath $projectDir)) {
    throw "Missing project directory: $projectDir"
  }

  Push-Location $projectDir
  try {
    clasp push
    "Pushed $projectName"
  }
  finally {
    Pop-Location
  }
}
