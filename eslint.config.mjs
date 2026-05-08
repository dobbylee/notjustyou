import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextVitals,
  {
    ignores: ["docs/**", "coverage/**"],
  },
];

export default eslintConfig;
