import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  stories: [
    "../../../packages/editor/src/**/*.stories.@(ts|tsx)",
    "../../../packages/player/src/**/*.stories.@(ts|tsx)",
  ],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-a11y",
    "@storybook/addon-interactions",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  async viteFinal(config) {
    return mergeConfig(config, {
      resolve: {
        alias: {
          "@interlacejs/core": fileURLToPath(
            new URL("../../../packages/core/src/index.ts", import.meta.url),
          ),
          "@interlacejs/editor": fileURLToPath(
            new URL("../../../packages/editor/src/index.ts", import.meta.url),
          ),
          "@interlacejs/player": fileURLToPath(
            new URL("../../../packages/player/src/index.ts", import.meta.url),
          ),
          "@interlacejs/native-adapter": fileURLToPath(
            new URL(
              "../../../packages/native-adapter/src/index.ts",
              import.meta.url,
            ),
          ),
        },
      },
    });
  },
};

export default config;
