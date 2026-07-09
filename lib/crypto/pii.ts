/**
 * lib/crypto/pii.ts
 * 자녀 PII(생년월일시·주소·학교) 암호화 — AES-256-GCM
 *
 * [절대 규칙] CLAUDE.md §8 — PII는 암호화·분리 저장.
 * 평문 PII를 DB에 저장하지 않는다. 애플리케이션 레이어(이 모듈)에서
 * 암호화 후 subjects 테이블의 enc* 컬럼에 넣는다.
 *
 * 키 관리:
 *   PII_ENC_KEY 환경변수 = 32바이트 키의 hex(64자) 또는 base64.
 *   미설정 시 개발 전용 고정키로 폴백하고 경고한다 (프로덕션 금지).
 *
 * 형식: "v1:" + base64(iv[12] || authTag[16] || ciphertext)
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

/** 개발 전용 폴백 키 — 프로덕션에서는 PII_ENC_KEY 필수 */
const DEV_FALLBACK = "gongbusaju-dev-only-pii-key-not-for-prod";
let warnedFallback = false;

/** 32바이트 암호화 키를 해석한다 (hex/base64/임의 문자열 모두 SHA-256으로 정규화). */
function resolveKey(): Buffer {
  const raw = process.env.PII_ENC_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "PII_ENC_KEY 환경변수가 없습니다 — 프로덕션에서 PII 암호화 키는 필수입니다."
      );
    }
    if (!warnedFallback) {
      console.warn(
        "[pii] PII_ENC_KEY 미설정 — 개발 전용 폴백 키 사용 (프로덕션 금지)."
      );
      warnedFallback = true;
    }
    return createHash("sha256").update(DEV_FALLBACK).digest();
  }
  // 정확히 32바이트 hex면 그대로, 아니면 SHA-256으로 32바이트 파생
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return createHash("sha256").update(raw).digest();
}

/**
 * 평문 문자열을 암호화한다.
 * @returns "v1:base64(iv|tag|ciphertext)"
 */
export function encryptPii(plain: string): string {
  const key = resolveKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([iv, tag, ct]).toString("base64")}`;
}

/**
 * 암호문을 복호화한다.
 * @throws 형식 오류·변조(인증 실패) 시
 */
export function decryptPii(enc: string): string {
  const [version, payload] = enc.split(":", 2);
  if (version !== VERSION || !payload) {
    throw new Error("PII 복호화 실패: 형식 불일치");
  }
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, resolveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** null/undefined를 그대로 통과시키는 암호화 (선택 필드용) */
export function encryptPiiNullable(plain: string | null | undefined): string | null {
  return plain == null || plain === "" ? null : encryptPii(plain);
}

/** null을 그대로 통과시키는 복호화 (선택 필드용) */
export function decryptPiiNullable(enc: string | null | undefined): string | null {
  return enc == null ? null : decryptPii(enc);
}

/**
 * 하위호환 복호화 — 암호문("v1:…")이면 복호화, 아니면 평문으로 간주해 그대로 반환.
 * 평문으로 저장돼 있던 레거시 값(암호화 도입 전 연락처)을 안전하게 읽기 위함.
 */
export function decryptPiiCompat(enc: string | null | undefined): string | null {
  if (enc == null) return null;
  if (!enc.startsWith(`${VERSION}:`)) return enc; // 레거시 평문
  return decryptPii(enc);
}

/**
 * 사주 계산 캐시 키 — 생년월일시·성별 해시 (PII 미포함, 단방향).
 * saju_results.inputHash 용. 같은 입력은 같은 해시 → 계산 재사용.
 */
export function sajuInputHash(input: {
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour?: number;
  birthMinute?: number;
  gender: "male" | "female";
}): string {
  const key = [
    input.birthYear,
    input.birthMonth,
    input.birthDay,
    input.birthHour ?? "x",
    input.birthMinute ?? 0,
    input.gender,
  ].join("|");
  return createHash("sha256").update(key).digest("hex");
}
