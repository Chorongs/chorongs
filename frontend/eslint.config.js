import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020, // 검사할 JS 문법 버전 (01 지시서 기준값)
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest', // 코드 해석은 최신 문법까지 허용 (01 지시서)
        ecmaFeatures: { jsx: true },
        sourceType: 'module', // import/export 문법을 쓰는 파일로 읽음 (01 지시서)
      },
    },
    rules: {
      // 안 쓰는 변수는 에러 (AGENT.md 규칙). 대문자, _로 시작하는 이름(컴포넌트, 상수)은 제외
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])
