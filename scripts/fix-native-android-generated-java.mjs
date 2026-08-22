import fs from 'node:fs/promises';
import path from 'node:path';

const pluginPath = path.resolve('android/app/src/main/java/app/orbidoc/workspace/OrbiDocNativePlugin.java');
let source = await fs.readFile(pluginPath, 'utf8');

// A normal JavaScript template interprets \n before writing the Java source.
// Restore the intended Java escape sequence so the generated string literal stays valid.
source = source.replace('append("\n\n");', 'append("\\n\\n");');

// Avoid layered escaping (JavaScript -> Java -> regex) for filename sanitation.
// ASCII code points 92 and 34 represent backslash and double quote respectively.
source = source.replace(
  /  private String safeName\(String value\) \{[^\n]*\}/,
  `  private String safeName(String value) {
    if (value == null) return "arquivo";
    String cleaned = value;
    for (char invalid : new char[]{92, '/', ':', '*', '?', 34, '<', '>', '|'}) cleaned = cleaned.replace(invalid, '_');
    return cleaned;
  }`,
);

if (source.includes('append("\n\n");')) {
  throw new Error('String Java de nova linha continua contendo quebra literal inválida.');
}
if (!source.includes("new char[]{92, '/', ':', '*', '?', 34, '<', '>', '|'")) {
  throw new Error('Normalização de nomes de arquivo não foi aplicada.');
}

await fs.writeFile(pluginPath, source, 'utf8');
console.log('Android generated Java: string escapes and filename sanitizer normalized.');
