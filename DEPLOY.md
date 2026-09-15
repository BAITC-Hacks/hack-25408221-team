# Azure Deployment — One-Time Setup

All commands use the Azure CLI. Run them once to provision infrastructure;
subsequent deployments happen automatically via GitHub Actions on push to `main`.

## Prerequisites

```bash
az --version    # 2.55+
az login
az account set --subscription "<YOUR_SUBSCRIPTION_ID>"
```

## 1. Shell variables

Set these once in your shell session:

```bash
RG="invision-rg"
LOCATION="eastus"
ACR="invisionacr"           # must be globally unique, lowercase alphanumeric
ENV="invision-env"
BACKEND="invision-backend"
FRONTEND="invision-frontend"
SUBSCRIPTION=$(az account show --query id -o tsv)
```

## 2. Resource group

```bash
az group create --name $RG --location $LOCATION
```

## 3. Container Registry

```bash
az acr create \
  --name $ACR \
  --resource-group $RG \
  --sku Basic \
  --admin-enabled true
```

## 4. Container Apps Environment

```bash
az containerapp env create \
  --name $ENV \
  --resource-group $RG \
  --location $LOCATION
```

## 5. Create backend Container App

Run once to provision with all secrets. **Fill in real values before running.**

```bash
az containerapp create \
  --name $BACKEND \
  --resource-group $RG \
  --environment $ENV \
  --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest \
  --target-port 8000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 1.0 \
  --memory 2.0Gi \
  --registry-server ${ACR}.azurecr.io \
  --registry-username $(az acr credential show -n $ACR --query username -o tsv) \
  --registry-password $(az acr credential show -n $ACR --query "passwords[0].value" -o tsv) \
  --secrets \
    gemini-api-key="<YOUR_GEMINI_API_KEY>" \
    db-host="<YOUR_RDS_HOSTNAME>" \
    aws-s3-bucket="<YOUR_S3_BUCKET_NAME>" \
    aws-access-key-id="<YOUR_AWS_ACCESS_KEY_ID>" \
    aws-secret-access-key="<YOUR_AWS_SECRET_ACCESS_KEY>" \
    jwt-secret="<RANDOM_64_CHAR_STRING>"
```

> **`--min-replicas 1`**: prevents cold starts during interviews.
> **`--max-replicas 3`**: each replica handles its own WebSocket connections independently.

## 6. Ensure HTTP/1.1 transport on backend  ← CRITICAL for WebSocket

WebSocket is an HTTP/1.1 upgrade. Azure Container Apps must use `http` transport
(not `http2` — HTTP/2 does not support the `Upgrade` header that WebSocket requires).
If the app was created with `auto`, verify it resolved to `http`:

```bash
az containerapp ingress update \
  --name $BACKEND \
  --resource-group $RG \
  --transport http
```

Verify:
```bash
az containerapp show \
  --name $BACKEND \
  --resource-group $RG \
  --query "properties.configuration.ingress.transport"
# Expected: "http"
```

## 7. Get backend URL

```bash
BACKEND_FQDN=$(az containerapp show \
  --name $BACKEND \
  --resource-group $RG \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "Backend HTTPS: https://${BACKEND_FQDN}"
echo "Backend WSS:   wss://${BACKEND_FQDN}"

# Record the domain suffix (everything after the app name prefix)
# e.g. if FQDN is invision-backend.redfield-abc123.eastus.azurecontainerapps.io
# then the suffix is: redfield-abc123.eastus.azurecontainerapps.io
```

## 8. Create frontend Container App

```bash
az containerapp create \
  --name $FRONTEND \
  --resource-group $RG \
  --environment $ENV \
  --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --registry-server ${ACR}.azurecr.io \
  --registry-username $(az acr credential show -n $ACR --query username -o tsv) \
  --registry-password $(az acr credential show -n $ACR --query "passwords[0].value" -o tsv)
```

## 9. Set GitHub Actions secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `AZURE_CREDENTIALS` | JSON from step 10 below |
| `ACA_DOMAIN_SUFFIX` | e.g. `redfield-abc123.eastus.azurecontainerapps.io` |
| `DB_PORT` | `5432` |
| `DB_USER` | Your RDS IAM database username |
| `DB_NAME` | Your database name |
| `DB_REGION` | e.g. `us-east-1` (RDS region) |
| `AWS_REGION` | e.g. `eu-west-1` (S3 region) |

## 10. Create service principal for GitHub Actions

```bash
az ad sp create-for-rbac \
  --name "invision-github-actions" \
  --role Contributor \
  --scopes /subscriptions/$SUBSCRIPTION/resourceGroups/$RG \
  --sdk-auth
```

Copy the entire JSON output → paste as `AZURE_CREDENTIALS` secret.

Grant the SP permission to push images to ACR:

```bash
SP_APPID=$(az ad sp list --display-name invision-github-actions --query "[0].appId" -o tsv)
ACR_ID=$(az acr show --name $ACR --query id -o tsv)
az role assignment create \
  --assignee $SP_APPID \
  --role AcrPush \
  --scope $ACR_ID
```

## 11. First deploy

```bash
git push origin main
```

GitHub Actions builds both images, pushes to ACR, and deploys both Container Apps.
Subsequent pushes to `main` redeploy automatically.

## 12. Verify

```bash
# Backend API docs
curl https://${BACKEND_FQDN}/docs

# WebSocket (requires: npm i -g wscat)
wscat -c wss://${BACKEND_FQDN}/ws/test-session-id

# Frontend
FRONTEND_FQDN=$(az containerapp show --name $FRONTEND --resource-group $RG \
  --query "properties.configuration.ingress.fqdn" -o tsv)
curl https://${FRONTEND_FQDN}
```

---

## AWS connectivity from Azure

The backend uses `DB_USE_IAM_AUTH=true` — boto3 generates a 15-minute RDS auth
token using `generate_db_auth_token`. From Azure there is no EC2 instance role,
so explicit credentials are required (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
stored as Container Apps secrets in step 5).

The AWS IAM user must have this policy:

```json
{
  "Effect": "Allow",
  "Action": "rds-db:connect",
  "Resource": "arn:aws:rds-db:<region>:<account-id>:dbuser:<db-resource-id>/<db-username>"
}
```

S3 access also uses the same credentials — no additional policy changes needed
beyond what was already working locally.

---

## Troubleshooting

**WebSocket 400/403**: Run step 6 (`--transport http`). If transport is set to
`http2`, WebSocket upgrades are rejected because HTTP/2 doesn't support the
`Upgrade` header.

**`generate_db_auth_token` fails**: Verify `DB_REGION` matches the RDS cluster
region and the IAM user has `rds-db:connect`. Test locally:
```bash
aws rds generate-db-auth-token --hostname $DB_HOST --port 5432 --username $DB_USER
```

**Frontend env vars show `undefined`**: `NEXT_PUBLIC_*` are build-time only.
Confirm the CI `docker build --build-arg` lines in the workflow have the correct
backend URL and the image was rebuilt (not reused from cache).
