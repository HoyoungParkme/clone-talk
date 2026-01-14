/**
 * 모듈명: config.postcss
 * 설명: PostCSS 플러그인 설정
 *
 * 주요 기능:
 * - Tailwind 설정 파일 연결
 * - Autoprefixer 적용
 *
 * 의존성:
 * - tailwindcss
 * - autoprefixer
 */

// 1. 표준 라이브러리
import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const tailwindConfig = path.resolve(configDir, "tailwind.config.ts");

/**
 * PostCSS 플러그인 설정을 반환합니다.
 */
export default {
  plugins: {
    tailwindcss: { config: tailwindConfig },
    autoprefixer: {},
  },
};
