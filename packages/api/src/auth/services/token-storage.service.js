"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenStorageService = void 0;
const common_1 = require("@nestjs/common");
let TokenStorageService = class TokenStorageService {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    async cacheAccessToken(projectId, provider, token, expiresIn) {
        const key = `oauth:access:${projectId}:${provider}`;
        const expiresKey = `oauth:expires:${projectId}:${provider}`;
        const expiresAt = Date.now() + expiresIn * 1000;
        const ttl = Math.max(expiresIn - 300, 60);
        await Promise.all([
            this.redis.set(key, token, { EX: ttl }),
            this.redis.set(expiresKey, expiresAt.toString(), { EX: ttl }),
        ]);
    }
    async getAccessToken(projectId, provider) {
        const key = `oauth:access:${projectId}:${provider}`;
        return await this.redis.get(key);
    }
    async getTokenExpiration(projectId, provider) {
        const key = `oauth:expires:${projectId}:${provider}`;
        const expiresAt = await this.redis.get(key);
        return expiresAt ? parseInt(expiresAt, 10) : null;
    }
    async clearAccessToken(projectId, provider) {
        const key = `oauth:access:${projectId}:${provider}`;
        const expiresKey = `oauth:expires:${projectId}:${provider}`;
        await Promise.all([this.redis.del(key), this.redis.del(expiresKey)]);
    }
    async needsRefresh(projectId, provider) {
        const expiresAt = await this.getTokenExpiration(projectId, provider);
        if (!expiresAt)
            return true;
        const fiveMinutes = 5 * 60 * 1000;
        return Date.now() + fiveMinutes >= expiresAt;
    }
};
exports.TokenStorageService = TokenStorageService;
exports.TokenStorageService = TokenStorageService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('REDIS_CLIENT')),
    __metadata("design:paramtypes", [Object])
], TokenStorageService);
//# sourceMappingURL=token-storage.service.js.map