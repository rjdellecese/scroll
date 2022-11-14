import resolveConfig from "tailwindcss/resolveConfig";
import type { Config } from "tailwindcss/types/config";
import type { DefaultColors } from "tailwindcss/types/generated/colors";

// TODO
// @ts-ignore
import tailwindConfig from "~tailwind.config.js";

const resolvedTailwindConfig = resolveConfig(tailwindConfig) as Config & {
  theme: { colors: DefaultColors };
};

export const appearance = {
  variables: {
    colorPrimary: resolvedTailwindConfig.theme.colors.yellow[600],
    colorTextOnPrimaryBackground:
      resolvedTailwindConfig.theme.colors.yellow[50],
    colorTextSecondary: resolvedTailwindConfig.theme.colors.stone[500],
    colorText: resolvedTailwindConfig.theme.colors.stone[900],
    colorSuccess: resolvedTailwindConfig.theme.colors.green[600],
    colorWarning: resolvedTailwindConfig.theme.colors.orange[600],
    colorDanger: resolvedTailwindConfig.theme.colors.red[600],
  },
};
