import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import importPlugin from "eslint-plugin-import";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      // 절대 규칙: lib/saju ↔ lib/schools 상호 import 금지
      // lib/saju 에서 lib/schools import 금지
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/schools/**", "@/lib/schools/**"],
              message:
                "lib/saju 는 lib/schools 를 import 할 수 없습니다. 두 레이어를 합치는 곳은 오직 lib/report 입니다.",
            },
          ],
        },
      ],
    },
    files: ["lib/saju/**/*.ts", "lib/saju/**/*.tsx"],
  },
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      // lib/schools 에서 lib/saju import 금지
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/saju/**", "@/lib/saju/**"],
              message:
                "lib/schools 는 lib/saju 를 import 할 수 없습니다. 두 레이어를 합치는 곳은 오직 lib/report 입니다.",
            },
          ],
        },
      ],
    },
    files: ["lib/schools/**/*.ts", "lib/schools/**/*.tsx"],
  },
];

export default eslintConfig;
