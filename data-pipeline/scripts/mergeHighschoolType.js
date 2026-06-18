/**
 * data-pipeline/scripts/mergeHighschoolType.js
 *
 * schoolinfo_basic.json(학교알리미 기본정보)의 highSchoolType을
 * schools.json(학교위치표준데이터)에 병기한다.
 *
 * 매칭 방법: 학교명 정규화(공백 제거) 후 정확 일치. 동명 학교는 두 파일 모두
 * 존재하므로 중복 없이 처리된다 (고교유형은 학교명이 전국 고유).
 *
 * 라이선스 근거: 학교기본정보 = 공공데이터 제1유형(출처표시, 영리·변경 자유)
 *   — 학교알리미 공식 개발자가이드 기준
 *
 * 사용법:
 *   node data-pipeline/scripts/mergeHighschoolType.js
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(__dirname, "../output");

const schools = JSON.parse(
  readFileSync(resolve(outputDir, "schools.json"), "utf-8")
);
const basic = JSON.parse(
  readFileSync(resolve(outputDir, "schoolinfo_basic.json"), "utf-8")
);

// 이름 정규화 (공백 제거)
const normalize = (name) => name.replace(/\s+/g, "");

// highSchoolType 룩업: 정규화 이름 → 유형
const typeMap = new Map();
for (const s of basic) {
  if (s.highSchoolType) {
    typeMap.set(normalize(s.name), s.highSchoolType);
  }
}

let merged = 0;
let notFound = 0;

const updated = schools.map((s) => {
  if (s.type !== "고등학교") return s;
  const ht = typeMap.get(normalize(s.name));
  if (ht) {
    merged++;
    return { ...s, highSchoolType: ht };
  }
  notFound++;
  return s;
});

writeFileSync(
  resolve(outputDir, "schools.json"),
  JSON.stringify(updated, null, 1),
  "utf-8"
);

console.log(`완료: 고교유형 병기 ${merged}건, 미매칭 ${notFound}건`);
console.log(`총 학교 수: ${updated.length}건`);
