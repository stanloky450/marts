import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    rules: {
      "react/no-unescaped-entities": "warn",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "warn",
      "import/no-anonymous-default-export": "off"
    }
  }
];

export default config;
