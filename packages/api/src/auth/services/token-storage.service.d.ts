import type { RedisClientType } from 'redis';
export declare class TokenStorageService {
    private readonly redis;
    constructor(redis: RedisClientType);
    cacheAccessToken(projectId: string, provider: string, token: string, expiresIn: number): Promise<void>;
    getAccessToken(projectId: string, provider: string): Promise<string | null>;
    getTokenExpiration(projectId: string, provider: string): Promise<number | null>;
    clearAccessToken(projectId: string, provider: string): Promise<void>;
    needsRefresh(projectId: string, provider: string): Promise<boolean>;
}
//# sourceMappingURL=token-storage.service.d.ts.map