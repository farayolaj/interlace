import { config as baseConfig } from "@repo/eslint-config/base";

/**
 * A custom ESLint configuration for libraries that use React.
 *
 * @type {import("eslint").Linter.Config[]} */
const config = [...baseConfig];

export default config;
