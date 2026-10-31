import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * 口令哈希：用 Node 自带的 scrypt，格式  scrypt$<salt>$<hash>
 * 不引入 bcrypt 之类的原生依赖，装包更省心。
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${key}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hash] = parts;
  try {
    const expected = Buffer.from(hash, 'hex');
    const actual = scryptSync(password, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** 口令强度校验：至少 6 位 */
export function checkPasswordStrength(password: string): string | null {
  if (typeof password !== 'string' || password.length < 6) return '密码至少 6 位';
  if (password.length > 128) return '密码太长了';
  return null;
}

/** 生成随机邀请码，例如 CA-7F3K-92QD */
export function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉了容易看错的 I O 0 1
  const pick = (n: number) =>
    Array.from(randomBytes(n))
      .map((b) => alphabet[b % alphabet.length])
      .join('');
  return `CA-${pick(4)}-${pick(4)}`;
}

/** 学号格式：4~20 位数字字母 */
export function isValidStudentNo(value: string): boolean {
  return /^[0-9A-Za-z]{4,20}$/.test(value);
}

/**
 * 生成一个临时密码，给管理员帮同学重置时用。
 * 去掉了容易看错的 0 O 1 l I，用连字符分段方便口头念。
 */
export function generateRandomPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (n: number) =>
    Array.from(randomBytes(n))
      .map((b) => alphabet[b % alphabet.length])
      .join('');
  return `${pick(4)}-${pick(4)}`;
}
