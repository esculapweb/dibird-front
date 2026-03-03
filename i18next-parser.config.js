module.exports = {
  locales: ['en', 'ru'],
  output: 'locales/$LOCALE.json',
  input: [
    'components/**/*.{js,ts,jsx,tsx}',
    'hooks/**/*.{js,ts,jsx,tsx}',
    'navigation/**/*.{js,ts,jsx,tsx}',
    'screens/**/*.{js,ts,jsx,tsx}',
    'services/**/*.{js,ts,jsx,tsx}',
    'store/**/*.{js,ts,jsx,tsx}',
    'util/**/*.{js,ts,jsx,tsx}'
  ],
  sort: true,
  verbose: true,
  lexers: {
    js: ['JavascriptLexer'],
    ts: ['JavascriptLexer'],
    jsx: ['JsxLexer'],
    tsx: ['JsxLexer']
  }
};