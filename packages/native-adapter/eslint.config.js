import { config as baseConfig } from "@repo/eslint-config/base";

/**
 * A custom ESLint configuration for this package.
 *
 * @type {import("eslint").Linter.Config[]} */
const config = [...baseConfig];

export default config;
