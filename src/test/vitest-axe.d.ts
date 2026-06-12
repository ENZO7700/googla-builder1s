import type { AxeMatchers } from 'vitest-axe';

declare module '@vitest/expect' {
  interface Assertion<T = unknown> {
    toHaveNoViolations: AxeMatchers['toHaveNoViolations'];
  }
}
