import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.{js,mjs}'],
    // useApi.js의 DEV_TOKEN 단축 경로(`process.env.NEXT_PUBLIC_AUTH_TOKEN`)가
    // 단위 테스트의 mock JWT를 우회하지 않도록 강제 빈 값 주입.
    // module load 시점에 평가되므로 vitest config 단계에서 설정.
    env: {
      NEXT_PUBLIC_AUTH_TOKEN: '',
    },
  },
});
