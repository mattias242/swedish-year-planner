# Environment Configuration

## Setup Guide för Scaleway Environment Variables

### 1. Skapa .env fil

Kopiera `.env.example` till `.env` och fyll i dina Scaleway-credentials:

```bash
cp .env.example .env
```

### 2. Hämta Scaleway credentials

#### a) Från Scaleway Console:
1. Gå till [Scaleway Console](https://console.scaleway.com)
2. Navigera till **Identity and Access Management (IAM)** → **API Keys**
3. Skapa eller använd befintlig API key
4. Kopiera **Access Key** och **Secret Key**

#### b) Från Scaleway CLI:
```bash
# Visa aktuell konfiguration
scw config get

# Hämta project ID
scw config get default-project-id

# Hämta organization ID  
scw config get default-organization-id
```

### 3. Konfigurera .env filen

```bash
# Scaleway API credentials
SCW_ACCESS_KEY=SCWXXXXXXXXXXXXXXXXX
SCW_SECRET_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SCW_DEFAULT_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SCW_DEFAULT_ORGANIZATION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Object Storage configuration
BUCKET_NAME=swedish-year-planner-prod

# Deployment configuration
ENVIRONMENT=prod
REGION=fr-par
ZONE=fr-par-1

# Function configuration (auto-generated efter första deployment)
NAMESPACE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
FUNCTION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 4. GitHub Secrets

För CI/CD pipeline behöver du lägga till samma variabler som GitHub Secrets:

1. Gå till ditt GitHub repo
2. **Settings** → **Secrets and variables** → **Actions**
3. Lägg till följande secrets:
   - `SCW_ACCESS_KEY`
   - `SCW_SECRET_KEY`
   - `SCW_DEFAULT_PROJECT_ID`
   - `SCW_DEFAULT_ORGANIZATION_ID`

### 5. Testa konfigurationen

```bash
# Manuell deployment med .env
./deploy.sh

# Eller testa API:et direkt
curl -X GET "https://your-api-url/api/health"
```

## Object Storage aktivering

När miljövariablerna är konfigurerade kommer appen automatiskt att:

1. **Använda Scaleway Object Storage** för persistent datalagring
2. **Fallback till in-memory storage** om credentials saknas
3. **Transparent växling** mellan lokalt och molnlagring

### Status indikator

Kolla API health endpoint för att se lagringstyp:
```bash
curl -X GET "https://your-api-url/api/health"
```

Response inkluderar information om Object Storage status.

## Säkerhet

⚠️ **VIKTIGT**: 
- Lägg ALDRIG credentials i git
- Använd `.env` endast för lokal utveckling
- Produktionscredentials hanteras via GitHub Secrets
- Rotera API keys regelbundet

## Troubleshooting

### Problem: "Cannot find module 'aws-sdk'"
**Lösning**: Säkerställ att dependencies är installerade i deployment:
```bash
cd functions && npm ci --production
```

### Problem: "Failed to save to Object Storage"
**Lösning**: Kontrollera credentials och bucket-behörigheter:
```bash
# Testa Scaleway CLI
scw object bucket list

# Kontrollera bucket
scw object bucket get bucket=swedish-year-planner-prod
```

### Problem: "Access Denied"
**Lösning**: Verifiera API key permissions:
1. IAM → API Keys → kontrollera scope
2. Säkerställ att keyn har Object Storage läs/skriv-behörighet

## Lokal utveckling

För lokal utveckling utan Object Storage:
```bash
# Kommentera ut credentials i .env eller:
NODE_ENV=development npm start
```

Appen kommer då använda localStorage istället för Object Storage.