import { PrismaClient, OAuthProvider } from '@prisma/client';
import { TokenEncryptionService } from '@/auth/services/token-encryption.service';
import { TokenStorageService } from '@/auth/services/token-storage.service';
import { OAuthService } from '@/auth/services/oauth.service';
export declare class TokenRefreshService {
    private readonly prisma;
    private readonly tokenEncryption;
    private readonly tokenStorage;
    private readonly oauthService;
    private readonly logger;
    constructor(prisma: PrismaClient, tokenEncryption: TokenEncryptionService, tokenStorage: TokenStorageService, oauthService: OAuthService);
    getAccessToken(projectId: string, provider: OAuthProvider): Promise<string>;
    refreshIfNeeded(projectId: string, provider: OAuthProvider): Promise<string>;
    forceRefresh(projectId: string, provider: OAuthProvider): Promise<string>;
    hasActiveConnection(projectId: string, provider: OAuthProvider): Promise<boolean>;
    getConnectionStatus(projectId: string, provider: OAuthProvider): Promise<{
        exists: boolean;
        isActive: boolean;
        refreshFailed: boolean;
        failureReason: string | null;
        lastRefreshed: Date | null;
    }>;
}
//# sourceMappingURL=token-refresh.service.d.ts.map