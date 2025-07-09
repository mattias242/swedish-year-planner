# Swedish Year Planner - Development Guide

## TDD (Test-Driven Development) Setup

Detta projekt använder TDD-principen med Jest för testning och lokal utveckling.

### Snabbstart

```bash
# Starta lokal utvecklingsserver
./deploy.sh --local

# Kör bara tester
./deploy.sh --test

# Deploya med tester (standard)
./deploy.sh

# Deploya utan tester (ej rekommenderat)
./deploy.sh --skip-tests
```

### Utvecklingsmiljö

#### Lokal Server
```bash
# Starta lokal server med JSON-fillagring
./deploy.sh --local

# Eller manuellt
cd functions
STORAGE_TYPE=local NODE_ENV=development npm run dev:local
```

**Funktioner:**
- 🗂️ **Lokal JSON-fillagring** i `functions/data/`
- 🔄 **Snabb utveckling** utan molnberoenden
- 🌐 **Samma API** som produktionsmiljön
- 📊 **Alla endpoints** fungerar lokalt

#### Test-Driven Development

```bash
# Kör alla tester
npm test

# Kör tester i watch-mode
npm run test:watch

# Kör bara API-tester
npm test -- --testNamePattern="API"
```

### Teststrukturen

```
functions/
├── __tests__/
│   ├── api.test.js          # API endpoint tester
│   ├── storage.test.js      # Storage adapter tester
│   └── integration.test.js  # Integration tester
├── storage.js               # Storage abstraction
├── local-server.js          # Utvecklingsserver
├── mock-data.js            # Mock data för tester
└── jest.config.js          # Jest konfiguration
```

### Storage Modes

#### 1. Memory Storage (Standard för tester)
```javascript
const storage = new StorageAdapter('memory');
```

#### 2. Local File Storage (Utveckling)
```javascript
const storage = new StorageAdapter('local');
// Sparar som JSON-filer i ./data/
```

#### 3. Object Storage (Produktion)
```javascript
const storage = new StorageAdapter('object-storage');
storage.configureS3(s3Client, bucketName);
```

### API Endpoints

| Endpoint | Method | Beskrivning |
|----------|--------|-------------|
| `/api/health` | GET | Hälsokontroll |
| `/api/events` | GET/POST | Hantera events |
| `/api/tasks` | GET/POST | Hantera tasks |
| `/api/analytics` | GET | Användarstatistik |
| `/api/backup` | GET/POST | Backup/restore |

### Tester

#### Enhetstester
- **API endpoints** - Testar alla API-funktioner
- **Storage adapter** - Testar alla lagringstyper
- **Error handling** - Testar felhantering

#### Integrationstester
- **Komplett workflow** - Testar hela användarflödet
- **Multi-user isolation** - Testar att användare är separerade
- **Backup/restore** - Testar backup-funktionalitet

#### Mock Data
```javascript
const { generateTestData } = require('./mock-data');
const { events, tasks } = generateTestData(10, 15);
```

### Utvecklingsflöde

1. **Skriv ett test** som beskriver ny funktionalitet
2. **Kör testet** och se att det failar
3. **Implementera funktionalitet** så testet passerar
4. **Refaktorera** koden om nödvändigt
5. **Upprepa** för nästa funktionalitet

### Deployment Pipeline

```bash
# Lokal utveckling
./deploy.sh --local

# Testa ändringar
./deploy.sh --test

# Deploya med tester (rekommenderat)
./deploy.sh

# Snabb deploy utan tester (ej rekommenderat)
./deploy.sh --skip-tests
```

### Miljövariabler

#### Utveckling
```bash
NODE_ENV=development
STORAGE_TYPE=local
```

#### Produktion
```bash
NODE_ENV=production
STORAGE_TYPE=object-storage
SCW_ACCESS_KEY=your-key
SCW_SECRET_KEY=your-secret
BUCKET_NAME=your-bucket
```

### Felsökning

#### Tester failar
```bash
# Kör tester med verbose output
npm test -- --verbose

# Kör bara ett test
npm test -- --testNamePattern="should save events"
```

#### Lokal server fungerar inte
```bash
# Kolla dependencies
cd functions && npm install

# Kolla port
lsof -i :3000

# Starta med debug
DEBUG=* npm run dev:local
```

### Coverage

```bash
# Kör tester med coverage
npm test -- --coverage

# Öppna coverage rapport
open coverage/lcov-report/index.html
```

### Best Practices

1. **Skriv tester först** (TDD)
2. **Använd beskrivande testnamn**
3. **Testa både success och error cases**
4. **Mocka externa beroenden**
5. **Håll tester snabba och isolerade**
6. **Kör tester före deployment**

### Nästa steg

- [ ] Lägg till end-to-end tester
- [ ] Implementera CI/CD pipeline
- [ ] Lägg till performance tester
- [ ] Integrera med GitHub Actions