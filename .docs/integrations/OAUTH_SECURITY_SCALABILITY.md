# OAuth Security & Scalability Guide

**Version:** 1.0.0
**Date:** 14 décembre 2025
**Status:** Production Recommendations

## 🔒 Sécurité

### ✅ Améliorations Implémentées (v1.1)

#### 1. State Cryptographiquement Sécurisé
```typescript
// ❌ AVANT (v1.0) - Faible entropie
const state = Math.random().toString(36).substring(2, 15); // ~64 bits

// ✅ APRÈS (v1.1) - Entropie cryptographique
const state = randomBytes(32).toString('hex'); // 256 bits - OWASP compliant
```

**Impact:**
- Protection contre bruteforce : 2^256 combinaisons vs 2^64
- Respect des standards OWASP pour session tokens
- Génération via API crypto Node.js (CSPRNG)

#### 2. Timing-Safe State Comparison
```typescript
// ❌ AVANT - Vulnérable aux timing attacks
if (cachedState !== state) { ... }

// ✅ APRÈS - Protection contre timing attacks
const stateMatch = timingSafeEqual(
  Buffer.from(cachedState, 'utf8'),
  Buffer.from(state, 'utf8')
);
```

**Impact:**
- Empêche l'extraction du state via analyse temporelle
- Temps de comparaison constant quelle que soit la différence
- Standard pour la validation de secrets

### 🚨 Recommandations Production Critiques

#### 1. Redis Security (CRITIQUE)

**Problème:** Redis sans authentification = accès total aux states

**Solution:**
```yaml
# docker-compose.yml ou redis.conf
redis:
  image: redis:7-alpine
  command: >
    --requirepass ${REDIS_PASSWORD}
    --tls-port 6380
    --tls-cert-file /tls/redis.crt
    --tls-key-file /tls/redis.key
    --tls-ca-cert-file /tls/ca.crt
  environment:
    - REDIS_PASSWORD=${REDIS_PASSWORD}
```

```typescript
// Configuration NestJS Redis
RedisModule.forRoot({
  config: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD, // ✅ Ajouter
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined, // ✅ TLS en prod
  },
})
```

**Checklist:**
- [ ] `REDIS_PASSWORD` configuré (32+ caractères aléatoires)
- [ ] TLS activé en production
- [ ] Redis isolé dans réseau privé (pas d'exposition publique)
- [ ] Firewall rules : Seulement API → Redis

#### 2. Rate Limiting (IMPORTANT)

**Problème:** Attaque par bruteforce sur les callbacks OAuth

**Solution:**
```typescript
// packages/api/src/auth/auth.controller.ts
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  // Max 5 tentatives de callback par IP par minute
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Get('figma/callback')
  async figmaCallback(...) { ... }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Get('linear/callback')
  async linearCallback(...) { ... }
}
```

```typescript
// app.module.ts
ThrottlerModule.forRoot([{
  ttl: 60000, // 1 minute
  limit: 10,  // 10 requests par défaut
}]),
```

#### 3. Audit Logging (IMPORTANT)

**Problème:** Pas de traçabilité des tentatives OAuth suspectes

**Solution:**
```typescript
// Ajouter dans exchangeAuthorizationCode()
this.logger.warn('OAuth callback attempt', {
  provider,
  projectId,
  state: state.substring(0, 8) + '...', // Partial state for audit
  success: false,
  reason: 'Invalid state',
  ip: request.ip,
  timestamp: new Date().toISOString(),
});
```

**Métriques à logger:**
- Toutes les tentatives de callback (succès/échec)
- States invalides/expirés
- IPs sources
- Temps entre authorization et callback
- Providers et projectIds concernés

#### 4. State Expiration Monitoring

**Problème:** States expirés sans visibilité

**Solution:**
```typescript
// Ajouter métriques Prometheus
import { Counter, Histogram } from 'prom-client';

const oauthStateExpired = new Counter({
  name: 'oauth_state_expired_total',
  help: 'Number of expired OAuth states',
  labelNames: ['provider'],
});

const oauthCallbackDuration = new Histogram({
  name: 'oauth_callback_duration_seconds',
  help: 'Time between auth initiation and callback',
  labelNames: ['provider'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600], // seconds
});
```

### 🛡️ Défenses en Profondeur (Defense in Depth)

| Couche | Contrôle | Implémenté | Priorité |
|--------|----------|------------|----------|
| **Application** | State cryptographique fort | ✅ v1.1 | ✅ FAIT |
| **Application** | Timing-safe comparison | ✅ v1.1 | ✅ FAIT |
| **Application** | Rate limiting | ❌ | 🔴 CRITIQUE |
| **Application** | Audit logging | ❌ | 🟡 IMPORTANT |
| **Infrastructure** | Redis AUTH | ❌ | 🔴 CRITIQUE |
| **Infrastructure** | Redis TLS | ❌ | 🔴 CRITIQUE |
| **Infrastructure** | Redis dans VPC privé | ❌ | 🟡 IMPORTANT |
| **Infrastructure** | Firewall rules | ❌ | 🟡 IMPORTANT |
| **Monitoring** | Métriques OAuth | ❌ | 🟡 IMPORTANT |
| **Monitoring** | Alertes anomalies | ❌ | 🟢 BONUS |

## 📈 Scalabilité

### Capacité Actuelle (Single Redis)

**Benchmarks:**
```
Scénario : 100,000 utilisateurs actifs
OAuth flows/heure : 10,000
Flows simultanés (10min window) : ~1,666

Ressources Redis:
- Clés actives : 3,332 (2 par flow)
- Mémoire : ~333 KB (100 bytes par clé)
- Ops/sec : ~5-6 (très faible charge)
- Latence : <1ms (local)

Verdict : ✅ Redis single instance suffit jusqu'à ~10M users
```

### Limitations & Points de Rupture

| Métrique | Limite Single Redis | Limite Cluster |
|----------|---------------------|----------------|
| **Connexions** | ~10k | ~100k+ |
| **Ops/sec** | ~100k | ~1M+ |
| **Mémoire** | ~64 GB | ~Illimité |
| **Latence** | <1ms | <5ms |
| **Disponibilité** | 99.9% | 99.99% |

**Point de rupture estimé:**
- **Sans HA:** Perte de service si Redis crash = 100% OAuth failures
- **Avec Sentinel:** ~30 secondes de downtime lors failover
- **Avec Cluster:** Pas de downtime

### Architecture High Availability

#### Option 1: Redis Sentinel (Recommandé pour <1M users)

```yaml
# docker-compose.yml
services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}

  redis-replica-1:
    image: redis:7-alpine
    command: redis-server --replicaof redis-master 6379 --requirepass ${REDIS_PASSWORD}

  redis-replica-2:
    image: redis:7-alpine
    command: redis-server --replicaof redis-master 6379 --requirepass ${REDIS_PASSWORD}

  redis-sentinel-1:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf

  redis-sentinel-2:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf

  redis-sentinel-3:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
```

**Avantages:**
- ✅ Automatic failover (30-60s)
- ✅ Read scaling (replicas)
- ✅ Simple à setup
- ✅ Compatible Redis clients existants

**Configuration NestJS:**
```typescript
RedisModule.forRoot({
  config: {
    sentinels: [
      { host: 'sentinel-1', port: 26379 },
      { host: 'sentinel-2', port: 26379 },
      { host: 'sentinel-3', port: 26379 },
    ],
    name: 'mymaster',
    password: process.env.REDIS_PASSWORD,
  },
})
```

#### Option 2: Redis Cluster (Pour >1M users)

```yaml
# Cluster avec 3 shards (master + replica)
redis-cluster:
  image: redis:7-alpine
  command: redis-cli --cluster create
    redis-1:6379 redis-2:6379 redis-3:6379
    redis-4:6379 redis-5:6379 redis-6:6379
    --cluster-replicas 1
```

**Avantages:**
- ✅ Sharding automatique
- ✅ Pas de SPOF
- ✅ Scale horizontal
- ✅ Haute disponibilité

**Trade-offs:**
- ⚠️ Complexité accrue
- ⚠️ Latence légèrement plus élevée
- ⚠️ Pas de multi-key transactions

### Monitoring & Alertes

**Métriques à surveiller:**

```typescript
// packages/api/src/auth/services/oauth.service.ts
import { Counter, Histogram, Gauge } from 'prom-client';

// States actifs dans Redis
const activeOAuthStates = new Gauge({
  name: 'oauth_active_states',
  help: 'Number of active OAuth states in Redis',
});

// Taux de succès des callbacks
const oauthCallbackSuccess = new Counter({
  name: 'oauth_callback_success_total',
  help: 'Successful OAuth callbacks',
  labelNames: ['provider'],
});

const oauthCallbackFailure = new Counter({
  name: 'oauth_callback_failure_total',
  help: 'Failed OAuth callbacks',
  labelNames: ['provider', 'reason'],
});

// Latence Redis
const redisLatency = new Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Redis operation latency',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});
```

**Alertes recommandées:**

```yaml
# Prometheus alerts.yml
groups:
  - name: oauth
    rules:
      - alert: OAuthHighFailureRate
        expr: rate(oauth_callback_failure_total[5m]) > 0.1
        annotations:
          summary: "OAuth failure rate > 10% in last 5min"

      - alert: RedisDown
        expr: up{job="redis"} == 0
        annotations:
          summary: "Redis is down - OAuth will fail"

      - alert: OAuthSlowCallbacks
        expr: histogram_quantile(0.95, oauth_callback_duration_seconds) > 10
        annotations:
          summary: "95th percentile OAuth callback > 10s"
```

### Performance Optimization

#### 1. Connection Pooling

```typescript
// Déjà implémenté dans @nestjs/redis
// Mais vérifier la config:
RedisModule.forRoot({
  config: {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    // Connection pool (ioredis default: 1)
    // Pour haute charge, augmenter si nécessaire
  },
})
```

#### 2. Pipeline Redis Operations

```typescript
// Si besoin d'optimiser davantage (actuellement pas nécessaire)
async cacheStateWithMapping(projectId: string, provider: string, state: string, ttl: number) {
  const pipeline = this.redis.pipeline();
  pipeline.set(`oauth:state:${projectId}:${provider}`, state, 'EX', ttl);
  pipeline.set(`oauth:state-map:${state}:${provider}`, projectId, 'EX', ttl);
  await pipeline.exec(); // 1 round-trip au lieu de 2
}
```

#### 3. TTL Optimisé

```typescript
// Actuel : 10 minutes (600s)
// Recommandation : Analyser les métriques et ajuster

// Si 95% des callbacks arrivent en <2min : réduire à 3min (économie mémoire)
// Si timeouts fréquents : augmenter à 15min

const OAUTH_STATE_TTL = parseInt(process.env.OAUTH_STATE_TTL || '600', 10);
```

## 🧪 Tests de Charge

### Scénario de Test

```bash
# k6 load test script
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 100 },   // Ramp-up
    { duration: '5m', target: 100 },   // Sustained
    { duration: '1m', target: 0 },     // Ramp-down
  ],
};

export default function () {
  // Simulate OAuth flow
  let authRes = http.post('http://api:3000/api/v1/auth/figma/authorize', {
    projectId: 'test-project',
  });

  check(authRes, {
    'auth initiated': (r) => r.status === 200,
  });
}
```

### Objectifs Performance

| Métrique | Objectif | Acceptable | Critique |
|----------|----------|------------|----------|
| **Latency p50** | <100ms | <500ms | >1s |
| **Latency p95** | <500ms | <2s | >5s |
| **Latency p99** | <1s | <5s | >10s |
| **Error rate** | <0.1% | <1% | >5% |
| **Throughput** | >1000 req/s | >100 req/s | <10 req/s |

## 📋 Checklist Déploiement Production

### Avant le Déploiement

- [x] State cryptographiquement sécurisé (256 bits)
- [x] Timing-safe state comparison
- [ ] Rate limiting activé sur callbacks
- [ ] Audit logging implémenté
- [ ] Redis AUTH configuré
- [ ] Redis TLS activé
- [ ] Redis Sentinel ou Cluster configuré
- [ ] Métriques Prometheus exposées
- [ ] Alertes configurées
- [ ] Tests de charge exécutés
- [ ] Runbook incident OAuth rédigé
- [ ] Backup/restore Redis testé

### Post-Déploiement

- [ ] Monitorer les métriques OAuth 24h
- [ ] Vérifier les alertes fonctionnent
- [ ] Tester failover Redis (si Sentinel/Cluster)
- [ ] Auditer les logs pour anomalies
- [ ] Documenter les incidents
- [ ] Ajuster les TTLs si nécessaire

## 🔗 Ressources

- [OWASP OAuth Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth_Security_Cheat_Sheet.html)
- [RFC 6749 - OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749)
- [Redis Sentinel Documentation](https://redis.io/docs/management/sentinel/)
- [Redis Security Best Practices](https://redis.io/docs/management/security/)

## 📝 Changelog

### v1.1.0 (2025-12-14)
- ✅ Implémenté state cryptographiquement sécurisé (256 bits)
- ✅ Ajouté timing-safe state comparison
- ✅ Documenté recommandations sécurité et scalabilité
- ⏳ Rate limiting - À implémenter
- ⏳ Redis AUTH/TLS - À configurer en production
- ⏳ Redis HA - À déployer selon charge

### v1.0.0 (2025-12-14)
- Implémentation initiale state-to-projectId mapping
- Support multi-tenant OAuth
