# Local Development Setup

Guide pour développer en local avec hot reload sans avoir à rebuilder les images Docker.

## Architecture du Setup

- **Infrastructure (Docker)** : PostgreSQL, Redis, Qdrant, Temporal, Mailpit, Ngrok, etc.
- **API & Worker (Local)** : Exécution en local avec hot reload NestJS

## Démarrage Rapide

### 1. Démarrer l'infrastructure uniquement

```bash
# Arrêter tous les containers Docker existants
pnpm docker:down

# Démarrer uniquement l'infrastructure (sans API/Worker)
pnpm infra:up
```

Cette commande démarre :
- PostgreSQL (port 5432)
- Redis (port 6379)
- Qdrant (ports 6333, 6334)
- Temporal (ports 7233, 8233)
- Temporal UI (port 8080)
- Web Frontend (port 3000)
- Mailpit (ports 1025, 8025)
- Ngrok (port 4040)
- Prometheus (port 9090)
- Grafana (port 3002)

### 2. Migrer/Pousser le schéma de base de données

```bash
# Première fois ou après modifications du schéma
pnpm db:push
# OU pour créer une migration
pnpm db:migrate
```

### 3. Lancer l'API en local

```bash
# Lancer uniquement l'API avec hot reload sur port 3001
cd packages/api && PORT=3001 pnpm dev

# OU depuis la racine avec variable d'environnement
PORT=3001 pnpm dev
```

L'API démarre sur **http://localhost:3001** (même port que dans Docker pour compatibilité avec le frontend).

### 4. (Optionnel) Lancer le Worker en local

**Seulement si vous travaillez sur des workflows Temporal** :

```bash
# Dans un autre terminal
pnpm dev:worker
```

### 5. Ou lancer tout ensemble en parallèle

**API + Worker seulement** :
```bash
pnpm dev:backend
```

**Stack complet (API + Worker + Web)** :
```bash
pnpm dev:all
```

Ces commandes démarrent tous les services dans un seul terminal avec logs colorés :
- **cyan** : API
- **magenta** : Worker
- **green** : Web frontend

## Ports

### Services
- **API (Local)** : http://localhost:3001
- **Web Frontend (Docker)** : http://localhost:3000
- **PostgreSQL** : localhost:5432
- **Redis** : localhost:6379
- **Qdrant** : localhost:6333 (REST), localhost:6334 (gRPC)
- **Temporal** : localhost:7233
- **Temporal UI** : http://localhost:8080
- **Mailpit UI** : http://localhost:8025
- **Ngrok Inspector** : http://localhost:4040
- **Prometheus** : http://localhost:9090
- **Grafana** : http://localhost:3002

## Configuration

Le fichier `.env` est déjà configuré pour pointer vers `localhost` pour tous les services :

```bash
DATABASE_URL=postgresql://devflow:changeme@localhost:5432/devflow?schema=public
REDIS_HOST=localhost
TEMPORAL_ADDRESS=localhost:7233
QDRANT_HOST=localhost
```

Aucune modification n'est nécessaire !

## Commandes Utiles

### Infrastructure
```bash
# Démarrer l'infrastructure
pnpm infra:up

# Arrêter l'infrastructure
pnpm infra:down

# Voir les logs de l'infrastructure
pnpm infra:logs

# Voir les logs d'un service spécifique
docker-compose -f docker-compose.infra.yml logs -f postgres
docker-compose -f docker-compose.infra.yml logs -f redis
```

### Développement
```bash
# API seulement (port 3001)
pnpm dev
# ou
pnpm dev:api

# Worker seulement (si besoin)
pnpm dev:worker

# Web frontend seulement
pnpm dev:web

# API + Worker en parallèle
pnpm dev:backend

# Stack complet : API + Worker + Web
pnpm dev:all
```

### Base de données
```bash
# Appliquer les changements de schéma
pnpm db:push

# Créer une migration
pnpm db:migrate

# Ouvrir Prisma Studio
pnpm --filter @devflow/api prisma:studio
```

## Avantages de ce Setup

1. **Hot Reload** : Les changements dans le code API/Worker sont instantanés
2. **Pas de Rebuild** : Plus besoin de rebuilder les images Docker
3. **Debug Facile** : Attachez facilement un debugger à l'API ou au Worker
4. **Performances** : Développement plus rapide sans overhead Docker
5. **Logs Clairs** : Logs séparés pour chaque service

## Workflow de Développement Typique

### Option 1 : API seulement (développement API/backend)
```bash
# Terminal 1 : Infrastructure
pnpm infra:up

# Terminal 2 : API
pnpm dev
```

### Option 2 : Backend complet (API + Worker)
```bash
# Terminal 1 : Infrastructure
pnpm infra:up

# Terminal 2 : API + Worker
pnpm dev:backend
```

### Option 3 : Stack complet (tout en un terminal) ⭐ Recommandé
```bash
# Terminal 1 : Infrastructure
pnpm infra:up

# Terminal 2 : API + Worker + Web
pnpm dev:all
```

**Avantage** : Tout démarre en un seul terminal avec logs colorés !
- 🔵 **cyan** : API
- 🟣 **magenta** : Worker
- 🟢 **green** : Web frontend

Les changements sont automatiquement rechargés pour tous les services !

## Troubleshooting

### Port 3001 déjà utilisé
```bash
# Trouver le processus
lsof -i :3001

# Tuer le processus
kill -9 <PID>
```

### Base de données pas accessible
```bash
# Vérifier que PostgreSQL tourne
docker ps | grep postgres

# Vérifier la connexion
psql postgresql://devflow:changeme@localhost:5432/devflow
```

### Redis pas accessible
```bash
# Vérifier que Redis tourne
docker ps | grep redis

# Tester la connexion
redis-cli ping
```

## Retour au Setup Docker Complet

Si vous préférez revenir au setup Docker complet :

```bash
# Arrêter l'infrastructure
pnpm infra:down

# Démarrer tout dans Docker
pnpm docker:up
```

Note : L'API reste sur le port **3001** dans les deux modes (local et Docker).
