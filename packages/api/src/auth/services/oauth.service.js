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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var OAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const sdk_1 = require("@devflow/sdk");
const token_encryption_service_1 = require("./token-encryption.service");
const token_storage_service_1 = require("./token-storage.service");
let OAuthService = OAuthService_1 = class OAuthService {
    prisma;
    tokenEncryption;
    tokenStorage;
    logger = new common_1.Logger(OAuthService_1.name);
    constructor(prisma, tokenEncryption, tokenStorage) {
        this.prisma = prisma;
        this.tokenEncryption = tokenEncryption;
        this.tokenStorage = tokenStorage;
    }
    async initiateDeviceFlow(projectId, provider) {
        this.logger.log(`Initiating Device Flow for ${provider} on project ${projectId}`);
        const config = sdk_1.OAUTH_CONSTANTS[provider];
        try {
            const response = await axios_1.default.post(config.DEVICE_CODE_URL, new URLSearchParams({
                client_id: config.CLIENT_ID,
                scope: config.SCOPES.join(' '),
            }), {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            return {
                deviceCode: response.data.device_code,
                userCode: response.data.user_code,
                verificationUri: response.data.verification_uri,
                expiresIn: response.data.expires_in,
                interval: response.data.interval || 5,
            };
        }
        catch (error) {
            this.logger.error(`Failed to initiate Device Flow for ${provider}`, error);
            throw new Error(`Failed to initiate OAuth: ${error.response?.data?.error_description || error.message}`);
        }
    }
    async pollForTokens(deviceCode, provider, projectId) {
        this.logger.log(`Polling for tokens: ${provider} on project ${projectId}`);
        const config = sdk_1.OAUTH_CONSTANTS[provider];
        const maxAttempts = 60;
        const interval = 5000;
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise((resolve) => setTimeout(resolve, interval));
            try {
                const response = await axios_1.default.post(config.TOKEN_URL, new URLSearchParams({
                    client_id: config.CLIENT_ID,
                    device_code: deviceCode,
                    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                }), {
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                });
                this.logger.log(`Authorization successful for ${provider}`);
                return await this.storeOAuthConnection(projectId, provider, response.data);
            }
            catch (error) {
                const errorCode = error.response?.data?.error;
                if (errorCode === 'authorization_pending') {
                    this.logger.debug(`Still waiting for authorization (attempt ${i + 1}/${maxAttempts})`);
                    continue;
                }
                else if (errorCode === 'slow_down') {
                    this.logger.debug('Provider requested slow down');
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                    continue;
                }
                else if (errorCode === 'expired_token') {
                    throw new Error('Device code expired. Please try again.');
                }
                else if (errorCode === 'access_denied') {
                    throw new Error('User denied authorization.');
                }
                else {
                    this.logger.error('Unexpected error during polling', error);
                    throw new Error(`Authorization failed: ${error.response?.data?.error_description || error.message}`);
                }
            }
        }
        throw new Error('Authorization timeout after 5 minutes.');
    }
    async storeOAuthConnection(projectId, provider, tokens) {
        let encryptedRefreshToken;
        let encryptionIv;
        if (tokens.refresh_token) {
            const encrypted = this.tokenEncryption.encrypt(tokens.refresh_token);
            encryptedRefreshToken = encrypted.ciphertext;
            encryptionIv = encrypted.iv;
        }
        const userInfo = await this.getUserInfo(provider, tokens.access_token);
        const expiresAt = tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000)
            : null;
        const connection = await this.prisma.oAuthConnection.upsert({
            where: {
                projectId_provider: { projectId, provider },
            },
            create: {
                projectId,
                provider,
                refreshToken: encryptedRefreshToken || '',
                encryptionIv: encryptionIv || '',
                scopes: tokens.scope.split(' '),
                expiresAt,
                providerUserId: userInfo.id,
                providerEmail: userInfo.email,
                isActive: true,
                lastRefreshed: new Date(),
            },
            update: {
                refreshToken: encryptedRefreshToken || '',
                encryptionIv: encryptionIv || '',
                scopes: tokens.scope.split(' '),
                expiresAt,
                providerUserId: userInfo.id,
                providerEmail: userInfo.email,
                isActive: true,
                lastRefreshed: new Date(),
                refreshFailed: false,
                failureReason: null,
            },
        });
        if (tokens.expires_in) {
            await this.tokenStorage.cacheAccessToken(projectId, provider, tokens.access_token, tokens.expires_in);
        }
        this.logger.log(`OAuth connection stored for ${provider} on project ${projectId}`);
        return connection;
    }
    async getUserInfo(provider, accessToken) {
        try {
            if (provider === 'GITHUB') {
                const response = await axios_1.default.get('https://api.github.com/user', {
                    headers: { Authorization: `token ${accessToken}` },
                });
                return {
                    id: response.data.login,
                    email: response.data.email || null,
                };
            }
            else if (provider === 'LINEAR') {
                const response = await axios_1.default.post('https://api.linear.app/graphql', {
                    query: '{ viewer { id email } }',
                }, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                });
                return {
                    id: response.data.data.viewer.id,
                    email: response.data.data.viewer.email || null,
                };
            }
            throw new Error(`Unsupported provider: ${provider}`);
        }
        catch (error) {
            this.logger.error(`Failed to get user info from ${provider}`, error);
            throw new Error(`Failed to get user info: ${error.message}`);
        }
    }
    async refreshToken(connection) {
        this.logger.log(`Refreshing token for ${connection.provider} on project ${connection.projectId}`);
        if (!connection.refreshToken || !connection.encryptionIv) {
            throw new Error('No refresh token available for this connection');
        }
        const refreshToken = this.tokenEncryption.decrypt(connection.refreshToken, connection.encryptionIv);
        const config = sdk_1.OAUTH_CONSTANTS[connection.provider];
        try {
            const response = await axios_1.default.post(config.TOKEN_URL, new URLSearchParams({
                client_id: config.CLIENT_ID,
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }), {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            const tokens = response.data;
            if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
                const encrypted = this.tokenEncryption.encrypt(tokens.refresh_token);
                await this.prisma.oAuthConnection.update({
                    where: { id: connection.id },
                    data: {
                        refreshToken: encrypted.ciphertext,
                        encryptionIv: encrypted.iv,
                        lastRefreshed: new Date(),
                        refreshFailed: false,
                        failureReason: null,
                    },
                });
            }
            else {
                await this.prisma.oAuthConnection.update({
                    where: { id: connection.id },
                    data: {
                        lastRefreshed: new Date(),
                        refreshFailed: false,
                        failureReason: null,
                    },
                });
            }
            if (tokens.expires_in) {
                await this.tokenStorage.cacheAccessToken(connection.projectId, connection.provider, tokens.access_token, tokens.expires_in);
            }
            this.logger.log(`Token refreshed successfully for ${connection.provider}`);
            return tokens.access_token;
        }
        catch (error) {
            this.logger.error(`Failed to refresh token for ${connection.provider}`, error);
            await this.prisma.oAuthConnection.update({
                where: { id: connection.id },
                data: {
                    refreshFailed: true,
                    failureReason: error.response?.data?.error_description || error.message,
                },
            });
            throw new Error(`Failed to refresh token: ${error.response?.data?.error_description || error.message}`);
        }
    }
    async revokeConnection(projectId, provider) {
        this.logger.log(`Revoking ${provider} connection for project ${projectId}`);
        await this.prisma.oAuthConnection.delete({
            where: { projectId_provider: { projectId, provider } },
        });
        await this.tokenStorage.clearAccessToken(projectId, provider);
        this.logger.log(`OAuth connection revoked for ${provider}`);
    }
    async getConnections(projectId) {
        return await this.prisma.oAuthConnection.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getConnection(projectId, provider) {
        return await this.prisma.oAuthConnection.findUnique({
            where: { projectId_provider: { projectId, provider } },
        });
    }
};
exports.OAuthService = OAuthService;
exports.OAuthService = OAuthService = OAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [client_1.PrismaClient,
        token_encryption_service_1.TokenEncryptionService,
        token_storage_service_1.TokenStorageService])
], OAuthService);
//# sourceMappingURL=oauth.service.js.map