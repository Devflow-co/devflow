import { PrismaClient, OAuthConnection, OAuthProvider } from '@prisma/client';
import { TokenEncryptionService } from '@/auth/services/token-encryption.service';
import { TokenStorageService } from '@/auth/services/token-storage.service';
interface DeviceFlowResponse {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    expiresIn: number;
    interval: number;
}
export declare class OAuthService {
    private readonly prisma;
    private readonly tokenEncryption;
    private readonly tokenStorage;
    private readonly logger;
    constructor(prisma: PrismaClient, tokenEncryption: TokenEncryptionService, tokenStorage: TokenStorageService);
    initiateDeviceFlow(projectId: string, provider: OAuthProvider): Promise<DeviceFlowResponse>;
    pollForTokens(deviceCode: string, provider: OAuthProvider, projectId: string): Promise<OAuthConnection>;
    private storeOAuthConnection;
    private getUserInfo;
    refreshToken(connection: OAuthConnection): Promise<string>;
    revokeConnection(projectId: string, provider: OAuthProvider): Promise<void>;
    getConnections(projectId: string): Promise<OAuthConnection[]>;
    getConnection(projectId: string, provider: OAuthProvider): Promise<OAuthConnection | null>;
}
export {};
//# sourceMappingURL=oauth.service.d.ts.map