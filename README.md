# Cultivators Ledger ![Project Status](https://img.shields.io/badge/status-alpha-orange)
Take the guess work out of growing cannabis.
## Overview
A cultivation analytics suite for growers who want precision data and full control over their environment.
Key features:
- **Real-time VPD tracking** – Know exactly when your plants are breathing optimally
- **Crop steering analytics** – Track dry-back slopes to dial in irrigation
- **DIY hardware support** – Connect your own sensors 
- **Manual data entry** – Use it as a digital journal, even without sensors
- **Multi-room / multi-zone support** – Monitor different environments separately
- **CSV import** – Bring your existing spreadsheets into the system
## Architecture
```mermaid
flowchart TD
    Sensors["ESP32 + HX711 load cell<br/>SHT45 temp/RH"] -->|"HTTP POST /api/ingest<br/>x-api-key header"| API["Next.js API Route<br/>src/app/api/ingest/route.ts"]

    API -->|"hashKey() → findFirst<br/>SensorConfig by apiKeyHash"| Auth{"Valid + active<br/>sensor?"}
    Auth -->|No| Reject["401 Invalid or inactive sensor"]
    Auth -->|Yes| Ping["UPDATE SensorConfig.lastPingAt"]

    Ping --> Body{"Body empty?"}
    Body -->|Yes| Pong["200 { type: 'ping' }<br/>(heartbeat, no writes)"]
    Body -->|No| Parse["Parse JSON<br/>weight data vs climate data"]

    Parse -->|"weight / currentWeight / weightLbs"| WeightBranch["WEIGHT PATH"]
    Parse -->|"temperature / humidity"| ClimateBranch["CLIMATE PATH"]

    WeightBranch --> Route{"Route by sensor.name<br/>small vs large/load cell"}
    Route -->|"small"| SmallPlant["findFirst plant<br/>stage NOT IN dry/cure/harvest"]
    Route -->|"large | load cell"| LargePlant["findFirst plant<br/>stage IN seedling/vegetative/flowering"]

    SmallPlant --> HasPot{"Pot-stage plant<br/>found?"}
    LargePlant --> HasPot
    HasPot -->|No| Skip["200 { skipped: 'no pot-stage plant' }<br/>NO DB WRITE"]
    HasPot -->|Yes| Irrig{"Weight jump > 1.5 lbs<br/>vs latest log?"}

    Irrig -->|Yes| IrrigEvt["INSERT IrrigationEvent<br/>source: 'auto'<br/>(5-min dedupe)"]
    Irrig -->|No| WW
    IrrigEvt --> WW["Resolve wetWeight<br/>1. Plant.wetWeight<br/>2. latest log wetWeightLbs<br/>3. (no fallback — skip dryback)"]

    WW --> Dryback["compute dryback %<br/>current formula: (wet − cur)/wet<br/>⚠️ target model under review"]
    Dryback --> InsertW["INSERT DryBackLog<br/>currentWeightLbs, dryBackPercent,<br/>sourceDevice = sensor.name"]
    InsertW --> PlantCW["UPDATE Plant.currentWeight"]

    ClimateBranch --> InsertC["INSERT ClimateLog<br/>airTempC, relativeHumidity,<br/>leafOffset, calculatedVpdKpa"]
    InsertC --> Reval["revalidatePath('/dashboard')"]

    InsertW --> Reval
    Skip --> Done(["200 response"])
    Pong --> Done
    Reject --> Done

    DB[("PostgreSQL (Supabase)<br/>Prisma client: src/lib/db.ts")]
    InsertW -.-> DB
    InsertC -.-> DB
    PlantCW -.-> DB
    IrrigEvt -.-> DB
    Ping -.-> DB

    DB -->|"Prisma server actions<br/>getPlants / getPlant / DashboardWrapper"| Readers["Server Components + Actions"]
    Readers -->|"serializePrisma()<br/>(Decimal → number)"| Client["Client Components<br/>Dashboard / Plants / PlantDetail"]
    Client -->|"computeDryback (local copy)<br/>formatWeight, PlantSummary"| UI["User Interface"]

    UI -->|"Set FC (single writer)"| SetFC["POST /api/plants/[id]/set-fc<br/>writes Plant.wetWeight + dryTarget<br/>+ reset DryBackLog"]
    SetFC -.-> DB

    classDef broken fill:#3b1f1f,stroke:#c0392b,color:#f5b7b1
    classDef fixed fill:#1f3b24,stroke:#27ae60,color:#a9dfbf
    classDef caution fill:#3b341f,stroke:#b7950b,color:#f7dc6f

    class Dryback,InsertW caution
    class HasPot,Skip,SetFC fixed
    class API,Route,WW caution
```
Get Involved
- Report bugs – Open an issue with the bug label
- Suggest features – Open an issue with the enhancement label
- Submit code – Fork the repo and open a pull request
- Ask questions – Start a discussion (if enabled)
## ⭐ Support
If this project is useful to you, consider starring the repo to help others find it.
