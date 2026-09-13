import { defineConfig } from 'vitest/config';

/**
 * Config separada para los tests de reglas: necesitan el emulador de Firestore
 * corriendo (`npm run test:reglas`, que lo levanta con `firebase emulators:exec`)
 * y Java 11+. Ver la cabecera de tests-reglas/acompanamientos.test.ts.
 *
 * Separada de la config normal (`npm test`) a proposito: sin el emulador arriba,
 * estos tests fallan todos, y no deben colarse en el test suite del dia a dia.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests-reglas/**/*.test.ts'],
    testTimeout: 20000,
    fileParallelism: false,
  },
});
