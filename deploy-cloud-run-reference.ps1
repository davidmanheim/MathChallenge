param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [string]$Region = 'us-central1',
  [string]$Service = 'puzzmmorpg',
  [string]$Repository = 'puzzmmorpg',
  [string]$Image = 'puzzmmorpg-server'
)

$ErrorActionPreference = 'Stop'

function Ensure-ProjectRole {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [Parameter(Mandatory = $true)]
    [string]$Member,

    [Parameter(Mandatory = $true)]
    [string]$Role
  )

  $policy = gcloud projects get-iam-policy $ProjectId `
    --flatten='bindings[].members' `
    --filter="bindings.role:$Role AND bindings.members:$Member" `
    --format='value(bindings.role)'

  if (-not $policy) {
    gcloud projects add-iam-policy-binding $ProjectId `
      --member=$Member `
      --role=$Role | Out-Null
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

gcloud config set project $ProjectId | Out-Null

gcloud services enable `
  run.googleapis.com `
  cloudbuild.googleapis.com `
  artifactregistry.googleapis.com `
  secretmanager.googleapis.com `
  firestore.googleapis.com `
  --project=$ProjectId | Out-Null

$shortSha = git rev-parse --short HEAD 2>$null
if (-not $shortSha) {
  $shortSha = Get-Date -Format 'yyyyMMddHHmmss'
}

$runtimeServiceAccount = "puzzmmorpg-run@$ProjectId.iam.gserviceaccount.com"
$runtimeServiceAccountExists = gcloud iam service-accounts describe $runtimeServiceAccount --format 'value(email)' 2>$null
if (-not $runtimeServiceAccountExists) {
  gcloud iam service-accounts create puzzmmorpg-run `
    --display-name='PuzzMMORPG Cloud Run runtime'
}

$repoExists = gcloud artifacts repositories describe $Repository --location $Region --format 'value(name)' 2>$null
if (-not $repoExists) {
  gcloud artifacts repositories create $Repository `
    --repository-format=docker `
    --location=$Region `
    --description='PuzzMMORPG containers'
}

$secretExists = gcloud secrets describe puzzmmorpg-jwt-secret --format 'value(name)' 2>$null
if (-not $secretExists) {
  $secretValue = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
  $secretValue | gcloud secrets create puzzmmorpg-jwt-secret --data-file=-
}

$cloudBuildServiceAccount = gcloud builds get-default-service-account --format 'value(serviceAccountEmail)' 2>$null
if (-not $cloudBuildServiceAccount) {
  $projectNumber = gcloud projects describe $ProjectId --format 'value(projectNumber)'
  $cloudBuildServiceAccount = "$projectNumber@cloudbuild.gserviceaccount.com"
}

Ensure-ProjectRole -ProjectId $ProjectId -Member "serviceAccount:${cloudBuildServiceAccount}" -Role 'roles/run.admin'
Ensure-ProjectRole -ProjectId $ProjectId -Member "serviceAccount:${cloudBuildServiceAccount}" -Role 'roles/artifactregistry.writer'
Ensure-ProjectRole -ProjectId $ProjectId -Member "serviceAccount:${cloudBuildServiceAccount}" -Role 'roles/iam.serviceAccountUser'
Ensure-ProjectRole -ProjectId $ProjectId -Member "serviceAccount:${runtimeServiceAccount}" -Role 'roles/secretmanager.secretAccessor'
Ensure-ProjectRole -ProjectId $ProjectId -Member "serviceAccount:${runtimeServiceAccount}" -Role 'roles/datastore.user'

gcloud builds submit `
  --config cloudbuild.yaml `
  --substitutions "_REGION=$Region,_SERVICE=$Service,_REPOSITORY=$Repository,_IMAGE=$Image,_TAG=$shortSha"
