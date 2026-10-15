// Mask comments and literals while retaining offsets for declaration scanners.
export function maskSource(source) {
  return source.replace(/\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
    token => token.replace(/[^\n]/g,' ')).replace(/^[ \t]*#.*$/gm, line=> ' '.repeat(line.length));
}
