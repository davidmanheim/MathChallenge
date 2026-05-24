param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [string]$Region = 'us-central1',
  [string]$Service = 'mathchallenge',
  [string]$Repository = 'mathchallenge',
  [string]$Image = 'mathchallenge-server'
)

$ErrorActionPreference = 'Stop'

function Ensure-ProjectRole {
  param(
    [Parameter(Mandatory = $true)] [string]$ProjectId,
    [Parameter(Mandatory = $true)] [string]$Member,
    [Parameter(Mandatory = $true)] [string]$Role
  )
  $existing = gcloud projects get-iam-policy $ProjectId `
    --flatten='bindings[].members' `
    --filter="bindings.role:$Role AND bindings.members:$Member" `
    --format='value(bindings.role)'
  if (-not $existing) {
    gcloud projects add-iam-policy-binding $ProjectId `
      --member=$Member `
      --role=$Role | Out-Null
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

gcloud config set project $ProjectId | Out-Null

Write-Host 'Enabling required APIs...'
gcloud services enable `
  run.googleapis.com `
  cloudbuild.googleapis.com `
  artifactregistry.googleapis.com `
  firestore.googleapis.com `
  --project=$ProjectId | Out-Null

# Firestore database (native mode) — idempotent after first run
$firestoreDb = gcloud firestore databases describe --project=$ProjectId --format='value(name)' 2>$null
if (-not $firestoreDb) {
  Write-Host 'Creating Firestore native-mode database...'
  gcloud firestore databases create --location=$Region --project=$ProjectId | Out-Null
}

$shortSha = git rev-parse --short HEAD 2>$null
if (-not $shortSha) { $shortSha = Get-Date -Format 'yyyyMMddHHmmss' }

# Runtime service account
$runtimeSA = "mathchallenge-run@$ProjectId.iam.gserviceaccount.com"
$runtimeSAExists = gcloud iam service-accounts describe $runtimeSA --format 'value(email)' 2>$null
if (-not $runtimeSAExists) {
  Write-Host 'Creating runtime service account...'
  gcloud iam service-accounts create mathchallenge-run `
    --display-name='MathChallenge Cloud Run runtime' `
    --project=$ProjectId
}

# Artifact Registry repository
$repoExists = gcloud artifacts repositories describe $Repository `
  --location=$Region --format 'value(name)' 2>$null
if (-not $repoExists) {
  Write-Host 'Creating Artifact Registry repository...'
  gcloud artifacts repositories create $Repository `
    --repository-format=docker `
    --location=$Region `
    --description='MathChallenge containers' `
    --project=$ProjectId
}

# Cloud Build service account
$cloudBuildSA = gcloud builds get-default-service-account `
  --project=$ProjectId --format 'value(serviceAccountEmail)' 2>$null
if (-not $cloudBuildSA) {
  $projectNumber = gcloud projects describe $ProjectId --format 'value(projectNumber)'
  $cloudBuildSA = "$projectNumber@cloudbuild.gserviceaccount.com"
}

Write-Host 'Ensuring IAM bindings...'
Ensure-ProjectRole -ProjectId $ProjectId -Member "serviceAccount:${cloudBuildSA}"  -Role 'roles/run.admin'
Ensure-ProjectRole -ProjectId $ProjectId -Member "serviceAccount:${cloudBuildSA}"  -Role 'roles/artifactregistry.writer'
Ensure-ProjectRole -ProjectId $ProjectId -Member "serviceAccount:${cloudBuildSA}"  -Role 'roles/iam.serviceAccountUser'
Ensure-ProjectRole -ProjectId $ProjectId -Member "serviceAccount:${runtimeSA}"     -Role 'roles/datastore.user'

Write-Host 'Ensuring Firestore composite index (profileId + submittedAt)...'
$indexExists = gcloud firestore indexes composite list --project=$ProjectId --format='value(name)' `
  --filter='fields.fieldPath=profileId AND fields.fieldPath=submittedAt' 2>$null
if (-not $indexExists) {
  gcloud firestore indexes composite create `
    --project=$ProjectId `
    --collection-group=attempts `
    --field-config=field-path=profileId,order=ascending `
    --field-config=field-path=submittedAt,order=ascending | Out-Null
  Write-Host 'Composite index creation started (builds async in Firestore).'
} else {
  Write-Host 'Composite index already exists.'
}

Write-Host "Submitting Cloud Build (tag: $shortSha)..."
gcloud builds submit `
  --config cloudbuild.yaml `
  --project=$ProjectId `
  --substitutions "_REGION=$Region,_SERVICE=$Service,_REPOSITORY=$Repository,_IMAGE=$Image,_TAG=$shortSha,_SERVICE_ACCOUNT=$runtimeSA"

# Verify
$serviceUrl = gcloud run services describe $Service `
  --region=$Region --project=$ProjectId --format='value(status.url)'
Write-Host "Service URL: $serviceUrl"

try {
  $health = Invoke-RestMethod "$serviceUrl/health" -TimeoutSec 15
  if ($health.status -eq 'ok') {
    Write-Host 'Health check passed.'
  } else {
    Write-Warning "Health check returned unexpected response: $($health | ConvertTo-Json)"
  }
} catch {
  Write-Warning "Health check request failed: $_"
}
