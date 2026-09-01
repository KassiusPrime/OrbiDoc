import fs from 'node:fs/promises';
import path from 'node:path';

const javaDir = path.resolve('android/app/src/main/java/app/orbidoc/workspace');
const mainActivityPath = path.join(javaDir, 'MainActivity.java');
const pluginPath = path.join(javaDir, 'OrbiDocNativePlugin.java');
const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');

await fs.mkdir(javaDir, { recursive: true });

const mainActivity = `package app.orbidoc.workspace;\n\nimport android.content.Intent;\nimport android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {\n  @Override\n  public void onCreate(Bundle savedInstanceState) {\n    super.onCreate(savedInstanceState);\n    registerPlugin(OrbiDocNativePlugin.class);\n  }\n\n  @Override\n  protected void onNewIntent(Intent intent) {\n    super.onNewIntent(intent);\n    setIntent(intent);\n  }\n}\n`;

const plugin = `package app.orbidoc.workspace;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "OrbiDocNative")
public class OrbiDocNativePlugin extends Plugin {
  private final ExecutorService executor = Executors.newCachedThreadPool();

  private String safeName(String value) {
    return value == null ? "arquivo" : value.replaceAll("[\\\\/:*?\"<>|]", "_");
  }

  private JSObject writeDownload(byte[] bytes, String fileName, String mimeType) throws Exception {
    ContentResolver resolver = getContext().getContentResolver();
    ContentValues values = new ContentValues();
    values.put(MediaStore.Downloads.DISPLAY_NAME, safeName(fileName));
    values.put(MediaStore.Downloads.MIME_TYPE, mimeType == null ? "application/octet-stream" : mimeType);
    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Orbit");
    values.put(MediaStore.Downloads.IS_PENDING, 1);
    Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
    if (uri == null) throw new Exception("Android recusou a criação do arquivo em Downloads.");
    try (OutputStream output = resolver.openOutputStream(uri)) {
      if (output == null) throw new Exception("Não foi possível abrir o arquivo de destino.");
      output.write(bytes);
    }
    values.clear();
    values.put(MediaStore.Downloads.IS_PENDING, 0);
    resolver.update(uri, values, null, null);
    JSObject result = new JSObject();
    result.put("uri", uri.toString());
    result.put("fileName", safeName(fileName));
    return result;
  }

  @PluginMethod
  public void saveBase64File(PluginCall call) {
    String fileName = call.getString("fileName", "arquivo");
    String mimeType = call.getString("mimeType", "application/octet-stream");
    String data = call.getString("dataBase64", "");
    executor.execute(() -> {
      try {
        call.resolve(writeDownload(Base64.decode(data, Base64.DEFAULT), fileName, mimeType));
      } catch (Exception error) {
        call.reject(error.getMessage(), error);
      }
    });
  }

  @PluginMethod
  public void downloadUrl(PluginCall call) {
    String url = call.getString("url", "");
    String requestedName = call.getString("fileName", "download");
    String requestedMime = call.getString("mimeType", "application/octet-stream");
    if (!url.startsWith("https://") && !url.startsWith("http://")) {
      call.reject("URL de download inválida.");
      return;
    }
    executor.execute(() -> {
      try {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(90000);
        conn.setInstanceFollowRedirects(true);
        if (conn.getResponseCode() >= 400) throw new Exception("Download respondeu HTTP " + conn.getResponseCode());
        String mime = conn.getContentType() == null ? requestedMime : conn.getContentType();
        try (InputStream input = conn.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
          byte[] buffer = new byte[16384];
          int read;
          while ((read = input.read(buffer)) >= 0) output.write(buffer, 0, read);
          call.resolve(writeDownload(output.toByteArray(), requestedName, mime));
        }
      } catch (Exception error) {
        call.reject(error.getMessage(), error);
      }
    });
  }

  @PluginMethod
  public void openUri(PluginCall call) {
    try {
      Uri uri = Uri.parse(call.getString("uri", ""));
      Intent intent = new Intent(Intent.ACTION_VIEW);
      intent.setDataAndType(uri, call.getString("mimeType", "*/*"));
      intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(intent);
      call.resolve();
    } catch (Exception error) {
      call.reject("Nenhum aplicativo compatível para abrir este arquivo.", error);
    }
  }

  private String displayName(Uri uri) {
    try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
      if (cursor != null && cursor.moveToFirst()) {
        int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
        if (index >= 0) return cursor.getString(index);
      }
    } catch (Exception ignored) {}
    return "arquivo";
  }

  @PluginMethod
  public void consumeOpenFile(PluginCall call) {
    try {
      Intent intent = getActivity().getIntent();
      Uri uri = intent == null ? null : intent.getData();
      if (uri == null && intent != null) uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
      JSObject result = new JSObject();
      if (uri == null) {
        result.put("available", false);
        call.resolve(result);
        return;
      }
      ByteArrayOutputStream output = new ByteArrayOutputStream();
      try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
        if (input == null) throw new Exception("Não foi possível ler o arquivo recebido.");
        byte[] buffer = new byte[16384];
        int read;
        int total = 0;
        while ((read = input.read(buffer)) >= 0) {
          total += read;
          if (total > 120 * 1024 * 1024) throw new Exception("Arquivo maior que 120 MB.");
          output.write(buffer, 0, read);
        }
      }
      result.put("available", true);
      result.put("name", displayName(uri));
      result.put("mimeType", getContext().getContentResolver().getType(uri));
      result.put("dataBase64", Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP));
      getActivity().setIntent(new Intent());
      call.resolve(result);
    } catch (Exception error) {
      call.reject(error.getMessage(), error);
    }
  }

  @Override
  protected void handleOnDestroy() {
    executor.shutdownNow();
    super.handleOnDestroy();
  }
}
`;

await fs.writeFile(mainActivityPath, mainActivity, 'utf8');
await fs.writeFile(pluginPath, plugin, 'utf8');

let manifest = await fs.readFile(manifestPath, 'utf8');
if (!manifest.includes('android.intent.action.VIEW')) {
  const filter = `\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="content" />\n                <data android:scheme="file" />\n                <data android:mimeType="application/pdf" />\n                <data android:mimeType="application/zip" />\n                <data android:mimeType="application/epub+zip" />\n                <data android:mimeType="application/vnd.openxmlformats-officedocument.wordprocessingml.document" />\n                <data android:mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />\n                <data android:mimeType="application/vnd.openxmlformats-officedocument.presentationml.presentation" />\n                <data android:mimeType="text/*" />\n                <data android:mimeType="image/*" />\n            </intent-filter>\n            <intent-filter>\n                <action android:name="android.intent.action.SEND" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <data android:mimeType="*/*" />\n            </intent-filter>`;
  manifest = manifest.replace(/(\s*<\/activity>)/, `${filter}$1`);
  await fs.writeFile(manifestPath, manifest, 'utf8');
}

console.log('Orbit Android native bridge: MediaStore Downloads and file intents configured; AI provider keys are not embedded or stored in the native plugin.');
