import fs from 'node:fs/promises';
import path from 'node:path';

const pluginPath = path.resolve('android/app/src/main/java/app/orbidoc/workspace/OrbiDocNativePlugin.java');
const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');
let source = await fs.readFile(pluginPath, 'utf8');

if (!source.includes('fetchUrlPayload(PluginCall call)')) {
  const method = `
  private String fileNameFromConnection(HttpURLConnection conn, String url) {
    String disposition = conn.getHeaderField("Content-Disposition");
    if (disposition != null) {
      String lower = disposition.toLowerCase(java.util.Locale.ROOT);
      int marker = lower.indexOf("filename*=");
      int offset = 10;
      if (marker < 0) { marker = lower.indexOf("filename="); offset = 9; }
      if (marker >= 0) {
        String raw = disposition.substring(marker + offset).split(";", 2)[0].trim();
        if (raw.toLowerCase(java.util.Locale.ROOT).startsWith("utf-8''")) raw = raw.substring(7);
        if (raw.startsWith("\\\"") && raw.endsWith("\\\"") && raw.length() > 1) raw = raw.substring(1, raw.length() - 1);
        try { return java.net.URLDecoder.decode(raw, "UTF-8"); } catch (Exception ignored) { return raw; }
      }
    }
    try {
      String path = new URL(url).getPath();
      String last = path.substring(path.lastIndexOf('/') + 1);
      return last.isEmpty() ? "download" : java.net.URLDecoder.decode(last, "UTF-8");
    } catch (Exception ignored) { return "download"; }
  }

  @PluginMethod
  public void fetchUrlPayload(PluginCall call) {
    String url = call.getString("url", "");
    if (!url.startsWith("https://") && !url.startsWith("http://")) { call.reject("URL de download inválida."); return; }
    executor.execute(() -> {
      try {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(15000); conn.setReadTimeout(90000); conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("User-Agent", "Orbit/Android");
        int status = conn.getResponseCode();
        if (status >= 400) throw new Exception("Download respondeu HTTP " + status + ".");
        long declared = conn.getContentLengthLong();
        if (declared > 300L * 1024L * 1024L) throw new Exception("Arquivo maior que 300 MB.");
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (InputStream input = conn.getInputStream()) {
          byte[] buffer = new byte[16384]; int read; long total = 0;
          while ((read = input.read(buffer)) >= 0) {
            total += read;
            if (total > 300L * 1024L * 1024L) throw new Exception("Download ultrapassou 300 MB.");
            output.write(buffer, 0, read);
          }
        }
        JSObject result = new JSObject();
        result.put("dataBase64", Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP));
        result.put("mimeType", conn.getContentType() == null ? "application/octet-stream" : conn.getContentType().split(";")[0]);
        result.put("fileName", safeName(fileNameFromConnection(conn, conn.getURL().toString())));
        result.put("sourceUrl", conn.getURL().toString());
        result.put("size", output.size());
        call.resolve(result);
      } catch (Exception error) { call.reject(error.getMessage(), error); }
    });
  }

`;
  const marker = '  @PluginMethod\n  public void openUri(PluginCall call) {';
  if (!source.includes(marker)) throw new Error('Ponto de inserção openUri não encontrado no plugin nativo.');
  source = source.replace(marker, method + marker);
  await fs.writeFile(pluginPath, source, 'utf8');
}

let manifest = await fs.readFile(manifestPath, 'utf8');
if (!manifest.includes('android.permission.INTERNET')) {
  manifest = manifest.replace(/<manifest\b[^>]*>/, (opening) => `${opening}\n    <uses-permission android:name="android.permission.INTERNET" />`);
  await fs.writeFile(manifestPath, manifest, 'utf8');
}

console.log('Android native network: HTTPS/public payload bridge and INTERNET permission configured.');
