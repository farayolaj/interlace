import { config as baseConfig } from "@repo/eslint-config/react-internal";

/**
 * A custom ESLint configuration for libraries that use React.
 *
 * @type {import("eslint").Linter.Config[]} */
const config = [...baseConfig];

export default config;