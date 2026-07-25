// Braum 布隆 CF 探针 — ESLint 配置（flat config）

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintPluginAstro from 'eslint-plugin-astro'

export default [
  // 全局忽略
  { ignores: ['**/dist/**', '**/.wrangler/**', '**/node_modules/**', '**/.astro/**'] },

  // JS 推荐规则
  js.configs.recommended,

  // TypeScript 规则
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // Astro 规则
  ...eslintPluginAstro.configs.recommended,

  // 全局规则
  {
    rules: {
      'no-console': 'off', // Workers 使用 console.log 输出结构化日志
      'prefer-const': 'warn',
    },
  },
]
