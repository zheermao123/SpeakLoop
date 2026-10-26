const konstaConfig = require('konsta/config');

module.exports = konstaConfig({
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './node_modules/konsta/react/**/*.{js,jsx}',
  ],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
  corePlugins: { preflight: false },
});
