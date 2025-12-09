export declare class TokenEncryptionService {
    private readonly algorithm;
    private readonly masterKey;
    constructor();
    encrypt(plaintext: string): {
        ciphertext: string;
        iv: string;
    };
    decrypt(ciphertext: string, iv: string): string;
}
//# sourceMappingURL=token-encryption.service.d.ts.map