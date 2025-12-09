"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenEncryptionService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
let TokenEncryptionService = class TokenEncryptionService {
    algorithm = 'aes-256-gcm';
    masterKey;
    constructor() {
        const key = process.env.OAUTH_ENCRYPTION_KEY;
        if (!key) {
            throw new Error('OAUTH_ENCRYPTION_KEY environment variable is required');
        }
        this.masterKey = Buffer.from(key, 'base64');
    }
    encrypt(plaintext) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        const authTag = cipher.getAuthTag();
        return {
            ciphertext: encrypted + ':' + authTag.toString('base64'),
            iv: iv.toString('base64'),
        };
    }
    decrypt(ciphertext, iv) {
        const [encrypted, authTagB64] = ciphertext.split(':');
        const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, Buffer.from(iv, 'base64'));
        decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
};
exports.TokenEncryptionService = TokenEncryptionService;
exports.TokenEncryptionService = TokenEncryptionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], TokenEncryptionService);
//# sourceMappingURL=token-encryption.service.js.map