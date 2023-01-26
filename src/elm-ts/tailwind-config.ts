import resolveConfig from "tailwindcss/resolveConfig";
import type { Config } from "tailwindcss/types/config";
import type { DefaultColors } from "tailwindcss/types/generated/colors";
import type { DefaultTheme } from "tailwindcss/types/generated/default-theme";

// @ts-ignore
import tailwindConfig from "~src/tailwind.config.js";

// eslint-disable-next-line no-type-assertion/no-type-assertion
export default resolveConfig(tailwindConfig) as Config & {
  theme: DefaultTheme & {
    width: DefaultTheme["spacing"];
    colors: DefaultColors;
  };
};
