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
var TokenRefreshService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenRefreshService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const token_encryption_service_1 = require("./token-encryption.service");
const token_storage_service_1 = require("./token-storage.service");
const oauth_service_1 = require("./oauth.service");
let TokenRefreshService = TokenRefreshService_1 = class TokenRefreshService {
    prisma;
    tokenEncryption;
    tokenStorage;
    oauthService;
    logger = new common_1.Logger(TokenRefreshService_1.name);
    constructor(prisma, tokenEncryption, tokenStorage, oauthService) {
        this.prisma = prisma;
        this.tokenEncryption = tokenEncryption;
        this.tokenStorage = tokenStorage;
        this.oauthService = oauthService;
    }
    async getAccessToken(projectId, provider) {
        const cached = await this.tokenStorage.getAccessToken(projectId, provider);
        if (cached) {
            this.logger.debug(`Using cached access token for ${provider} on project ${projectId}`);
            return cached;
        }
        this.logger.log(`Access token not cached, refreshing for ${provider} on project ${projectId}`);
        return await this.refreshIfNeeded(projectId, provider);
    }
    async refreshIfNeeded(projectId, provider) {
        const connection = await this.prisma.oAuthConnection.findUnique({
            where: { projectId_provider: { projectId, provider } },
        });
        if (!connection) {
            throw new Error(`No OAuth connection found for project ${projectId} and provider ${provider}`);
        }
        if (!connection.isActive) {
            throw new Error(`OAuth connection is inactive for project ${projectId} and provider ${provider}`);
        }
        if (connection.refreshFailed) {
            throw new Error(`OAuth connection has failed refresh: ${connection.failureReason}`);
        }
        const needsRefresh = await this.tokenStorage.needsRefresh(projectId, provider);
        if (!needsRefresh) {
            const cached = await this.tokenStorage.getAccessToken(projectId, provider);
            if (cached) {
                return cached;
            }
        }
        this.logger.log(`Refreshing access token for ${provider} on project ${projectId}`);
        try {
            const accessToken = await this.oauthService.refreshToken(connection);
            return accessToken;
        }
        catch (error) {
            this.logger.error(`Failed to refresh token for ${provider} on project ${projectId}`, error);
            throw new Error(`Failed to refresh OAuth token: ${error.message}`);
        }
    }
    async forceRefresh(projectId, provider) {
        this.logger.log(`Force refreshing token for ${provider} on project ${projectId}`);
        const connection = await this.prisma.oAuthConnection.findUnique({
            where: { projectId_provider: { projectId, provider } },
        });
        if (!connection) {
            throw new Error(`No OAuth connection found for project ${projectId} and provider ${provider}`);
        }
        await this.tokenStorage.clearAccessToken(projectId, provider);
        return await this.oauthService.refreshToken(connection);
    }
    async hasActiveConnection(projectId, provider) {
        const connection = await this.prisma.oAuthConnection.findUnique({
            where: { projectId_provider: { projectId, provider } },
        });
        return connection !== null && connection.isActive && !connection.refreshFailed;
    }
    async getConnectionStatus(projectId, provider) {
        const connection = await this.prisma.oAuthConnection.findUnique({
            where: { projectId_provider: { projectId, provider } },
        });
        if (!connection) {
            return {
                exists: false,
                isActive: false,
                refreshFailed: false,
                failureReason: null,
                lastRefreshed: null,
            };
        }
        return {
            exists: true,
            isActive: connection.isActive,
            refreshFailed: connection.refreshFailed,
            failureReason: connection.failureReason,
            lastRefreshed: connection.lastRefreshed,
        };
    }
};
exports.TokenRefreshService = TokenRefreshService;
exports.TokenRefreshService = TokenRefreshService = TokenRefreshService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [client_1.PrismaClient,
        token_encryption_service_1.TokenEncryptionService,
        token_storage_service_1.TokenStorageService,
        oauth_service_1.OAuthService])
], TokenRefreshService);
//# sourceMappingURL=token-refresh.service.js.map