import fs from 'node:fs/promises';
import path from 'node:path';

const pluginPath = path.resolve('android/app/src/main/java/app/orbidoc/workspace/OrbiDocNativePlugin.java');
let source = await fs.readFile(pluginPath, 'utf8');

// Older generated plugins contained an AI prompt builder whose Java newline
// escape could be consumed by the JavaScript template. Keep this normalization
// idempotent while allowing the new file-only Orbit bridge to omit that code.
if (source.includes('append("\n\n");')) {
  source = source.replaceAll('append("\n\n");', 'append("\\n\\n");');
}

// Avoid layered escaping (JavaScript -> Java -> regex) for filename sanitation.
// ASCII code points 92 and 34 represent backslash and double quote respectively.
const safeNameBlock = `  private String safeName(String value) {
    if (value == null) return "arquivo";
    String cleaned = value;
    for (char invalid : new char[]{92, '/', ':', '*', '?', 34, '<', '>', '|'}) cleaned = cleaned.replace(invalid, '_');
    return cleaned;
  }

  private JSObject writeDownload`;

if (!source.includes("new char[]{92, '/', ':', '*', '?', 34, '<', '>', '|'")) {
  source = source.replace(
    /  private String safeName\(String value\) \{[\s\S]*?\n  \}\n\n  private JSObject writeDownload/,
    safeNameBlock,
  );
}

if (source.includes('append("\n\n");')) {
  throw new Error('String Java de nova linha continua contendo quebra literal inválida.');
}
if (!source.includes("new char[]{92, '/', ':', '*', '?', 34, '<', '>', '|'")) {
  throw new Error('Normalização de nomes de arquivo não foi aplicada.');
}
if (/aiComplete\(|setAiKey\(|getAiStatus\(|listAiModels\(/.test(source)) {
  throw new Error('A ponte Android ainda contém métodos nativos de provedor de IA.');
}

await fs.writeFile(pluginPath, source, 'utf8');
console.log('Orbit Android generated Java: filename sanitizer normalized; no native AI provider fork detected.');
