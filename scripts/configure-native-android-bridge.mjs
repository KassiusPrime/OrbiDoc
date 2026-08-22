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
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Iterator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "OrbiDocNative")
public class OrbiDocNativePlugin extends Plugin {
  private static final String PREFS = "orbidoc_secure_v1";
  private static final String KEY_ALIAS = "orbidoc_ai_master_v1";
  private final ExecutorService executor = Executors.newCachedThreadPool();

  private boolean allowed(String provider) {
    return "gemini".equals(provider) || "groq".equals(provider) || "openrouter".equals(provider);
  }

  private SharedPreferences prefs() { return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

  private SecretKey secretKey() throws Exception {
    KeyStore store = KeyStore.getInstance("AndroidKeyStore");
    store.load(null);
    if (store.containsAlias(KEY_ALIAS)) return (SecretKey) store.getKey(KEY_ALIAS, null);
    KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .build());
    return generator.generateKey();
  }

  private String encrypt(String value) throws Exception {
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.ENCRYPT_MODE, secretKey());
    byte[] cipherText = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
    return Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(cipherText, Base64.NO_WRAP);
  }

  private String decrypt(String value) throws Exception {
    if (value == null || !value.contains(":")) return null;
    String[] parts = value.split(":", 2);
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.DECRYPT_MODE, secretKey(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
    return new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
  }

  private String apiKey(String provider) throws Exception { return decrypt(prefs().getString("ai_" + provider, null)); }

  @PluginMethod
  public void getAiStatus(PluginCall call) {
    JSArray providers = new JSArray();
    for (String provider : new String[]{"gemini", "groq", "openrouter"}) {
      JSObject item = new JSObject();
      item.put("provider", provider);
      item.put("configured", prefs().contains("ai_" + provider));
      providers.put(item);
    }
    JSObject result = new JSObject(); result.put("providers", providers); call.resolve(result);
  }

  @PluginMethod
  public void setAiKey(PluginCall call) {
    String provider = call.getString("provider", "");
    String apiKey = call.getString("apiKey", "").trim();
    if (!allowed(provider) || apiKey.length() < 10) { call.reject("Provedor ou chave inválidos."); return; }
    try {
      prefs().edit().putString("ai_" + provider, encrypt(apiKey)).apply();
      JSObject result = new JSObject(); result.put("configured", true); call.resolve(result);
    } catch (Exception error) { call.reject("Não foi possível proteger a chave no Android Keystore.", error); }
  }

  @PluginMethod
  public void clearAiKey(PluginCall call) {
    String provider = call.getString("provider", "");
    if (!allowed(provider)) { call.reject("Provedor inválido."); return; }
    prefs().edit().remove("ai_" + provider).apply(); call.resolve();
  }

  private String read(HttpURLConnection connection) throws Exception {
    InputStream stream = connection.getResponseCode() >= 400 ? connection.getErrorStream() : connection.getInputStream();
    if (stream == null) return "";
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    byte[] buffer = new byte[8192]; int read;
    while ((read = stream.read(buffer)) >= 0) output.write(buffer, 0, read);
    return output.toString(StandardCharsets.UTF_8.name());
  }

  private HttpURLConnection connection(String url, String method, String provider, String key) throws Exception {
    HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
    conn.setRequestMethod(method); conn.setConnectTimeout(15000); conn.setReadTimeout(70000);
    conn.setRequestProperty("Accept", "application/json");
    if (!"GET".equals(method)) conn.setRequestProperty("Content-Type", "application/json");
    if (!"gemini".equals(provider)) conn.setRequestProperty("Authorization", "Bearer " + key);
    if ("openrouter".equals(provider)) conn.setRequestProperty("X-Title", "OrbiDoc");
    return conn;
  }

  private void writeJson(HttpURLConnection conn, JSONObject json) throws Exception {
    conn.setDoOutput(true);
    try (OutputStream output = conn.getOutputStream()) { output.write(json.toString().getBytes(StandardCharsets.UTF_8)); }
  }

  @PluginMethod
  public void listAiModels(PluginCall call) {
    String provider = call.getString("provider", "");
    if (!allowed(provider)) { call.reject("Provedor inválido."); return; }
    executor.execute(() -> {
      try {
        String key = apiKey(provider); if (key == null) throw new Exception("Configure a chave deste provedor primeiro.");
        String url = "gemini".equals(provider)
          ? "https://generativelanguage.googleapis.com/v1beta/models?key=" + Uri.encode(key)
          : "groq".equals(provider) ? "https://api.groq.com/openai/v1/models" : "https://openrouter.ai/api/v1/models";
        HttpURLConnection conn = connection(url, "GET", provider, key);
        String text = read(conn); int status = conn.getResponseCode();
        if (status >= 400) throw new Exception("Provedor respondeu HTTP " + status + ". " + text.substring(0, Math.min(220, text.length())));
        JSONObject root = new JSONObject(text); JSArray models = new JSArray();
        if ("gemini".equals(provider)) {
          JSONArray list = root.optJSONArray("models");
          if (list != null) for (int i = 0; i < list.length(); i++) {
            JSONObject model = list.optJSONObject(i); if (model == null) continue;
            JSONArray methods = model.optJSONArray("supportedGenerationMethods"); boolean generative = false;
            if (methods != null) for (int j = 0; j < methods.length(); j++) if ("generateContent".equals(methods.optString(j))) generative = true;
            if (!generative) continue;
            JSObject item = new JSObject(); item.put("id", model.optString("name").replace("models/", "")); item.put("label", model.optString("displayName", model.optString("name"))); models.put(item);
          }
        } else {
          JSONArray list = root.optJSONArray("data");
          if (list != null) for (int i = 0; i < list.length(); i++) {
            JSONObject model = list.optJSONObject(i); if (model == null || model.optString("id").isEmpty()) continue;
            JSObject item = new JSObject(); item.put("id", model.optString("id")); item.put("label", model.optString("name", model.optString("id"))); models.put(item);
          }
        }
        JSObject result = new JSObject(); result.put("models", models); call.resolve(result);
      } catch (Exception error) { call.reject(error.getMessage(), error); }
    });
  }

  @PluginMethod
  public void aiComplete(PluginCall call) {
    String provider = call.getString("provider", ""); String model = call.getString("model", ""); JSArray messages = call.getArray("messages");
    if (!allowed(provider) || model.isEmpty() || messages == null) { call.reject("Requisição de IA inválida."); return; }
    executor.execute(() -> {
      try {
        String key = apiKey(provider); if (key == null) throw new Exception("Configure a chave de " + provider + " no aparelho.");
        JSONObject request = new JSONObject(); String url;
        if ("gemini".equals(provider)) {
          url = "https://generativelanguage.googleapis.com/v1beta/models/" + Uri.encode(model) + ":generateContent?key=" + Uri.encode(key);
          StringBuilder prompt = new StringBuilder();
          for (int i = 0; i < messages.length(); i++) { JSONObject msg = messages.optJSONObject(i); if (msg != null) prompt.append(msg.optString("role").toUpperCase()).append(": ").append(msg.optString("content")).append("\n\n"); }
          JSONArray parts = new JSONArray().put(new JSONObject().put("text", prompt.toString()));
          request.put("contents", new JSONArray().put(new JSONObject().put("role", "user").put("parts", parts)));
        } else {
          url = "groq".equals(provider) ? "https://api.groq.com/openai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
          request.put("model", model); request.put("messages", new JSONArray(messages.toString())); request.put("temperature", 0.4);
        }
        HttpURLConnection conn = connection(url, "POST", provider, key); writeJson(conn, request);
        String text = read(conn); int status = conn.getResponseCode();
        if (status >= 400) throw new Exception("Provedor respondeu HTTP " + status + ". " + text.substring(0, Math.min(300, text.length())));
        JSONObject root = new JSONObject(text); String answer = "";
        if ("gemini".equals(provider)) {
          JSONArray candidates = root.optJSONArray("candidates");
          if (candidates != null && candidates.length() > 0) {
            JSONObject content = candidates.optJSONObject(0).optJSONObject("content"); JSONArray parts = content == null ? null : content.optJSONArray("parts");
            if (parts != null) for (int i = 0; i < parts.length(); i++) answer += parts.optJSONObject(i).optString("text");
          }
        } else {
          JSONArray choices = root.optJSONArray("choices");
          if (choices != null && choices.length() > 0) answer = choices.optJSONObject(0).optJSONObject("message").optString("content");
        }
        if (answer.trim().isEmpty()) throw new Exception("Resposta vazia do provedor.");
        JSObject result = new JSObject(); result.put("text", answer); result.put("provider", provider); result.put("model", model); call.resolve(result);
      } catch (Exception error) { call.reject(error.getMessage(), error); }
    });
  }

  private String safeName(String value) { return value == null ? "arquivo" : value.replaceAll("[\\\\/:*?\"<>|]", "_"); }

  private JSObject writeDownload(byte[] bytes, String fileName, String mimeType) throws Exception {
    ContentResolver resolver = getContext().getContentResolver(); ContentValues values = new ContentValues();
    values.put(MediaStore.Downloads.DISPLAY_NAME, safeName(fileName)); values.put(MediaStore.Downloads.MIME_TYPE, mimeType == null ? "application/octet-stream" : mimeType);
    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/OrbiDoc"); values.put(MediaStore.Downloads.IS_PENDING, 1);
    Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values); if (uri == null) throw new Exception("Android recusou a criação do arquivo em Downloads.");
    try (OutputStream output = resolver.openOutputStream(uri)) { if (output == null) throw new Exception("Não foi possível abrir o arquivo de destino."); output.write(bytes); }
    values.clear(); values.put(MediaStore.Downloads.IS_PENDING, 0); resolver.update(uri, values, null, null);
    JSObject result = new JSObject(); result.put("uri", uri.toString()); result.put("fileName", safeName(fileName)); return result;
  }

  @PluginMethod
  public void saveBase64File(PluginCall call) {
    String fileName = call.getString("fileName", "arquivo"); String mimeType = call.getString("mimeType", "application/octet-stream"); String data = call.getString("dataBase64", "");
    executor.execute(() -> { try { call.resolve(writeDownload(Base64.decode(data, Base64.DEFAULT), fileName, mimeType)); } catch (Exception error) { call.reject(error.getMessage(), error); } });
  }

  @PluginMethod
  public void downloadUrl(PluginCall call) {
    String url = call.getString("url", ""); String requestedName = call.getString("fileName", "download"); String requestedMime = call.getString("mimeType", "application/octet-stream");
    if (!url.startsWith("https://") && !url.startsWith("http://")) { call.reject("URL de download inválida."); return; }
    executor.execute(() -> {
      try {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection(); conn.setConnectTimeout(15000); conn.setReadTimeout(90000); conn.setInstanceFollowRedirects(true);
        if (conn.getResponseCode() >= 400) throw new Exception("Download respondeu HTTP " + conn.getResponseCode());
        String mime = conn.getContentType() == null ? requestedMime : conn.getContentType(); String name = requestedName;
        try (InputStream input = conn.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) { byte[] buffer = new byte[16384]; int read; while ((read = input.read(buffer)) >= 0) output.write(buffer, 0, read); call.resolve(writeDownload(output.toByteArray(), name, mime)); }
      } catch (Exception error) { call.reject(error.getMessage(), error); }
    });
  }

  @PluginMethod
  public void openUri(PluginCall call) {
    try {
      Uri uri = Uri.parse(call.getString("uri", "")); Intent intent = new Intent(Intent.ACTION_VIEW); intent.setDataAndType(uri, call.getString("mimeType", "*/*")); intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(intent); call.resolve();
    } catch (Exception error) { call.reject("Nenhum aplicativo compatível para abrir este arquivo.", error); }
  }

  private String displayName(Uri uri) {
    try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
      if (cursor != null && cursor.moveToFirst()) { int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME); if (index >= 0) return cursor.getString(index); }
    } catch (Exception ignored) {}
    return "arquivo";
  }

  @PluginMethod
  public void consumeOpenFile(PluginCall call) {
    try {
      Intent intent = getActivity().getIntent(); Uri uri = intent == null ? null : intent.getData();
      if (uri == null && intent != null) uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
      JSObject result = new JSObject();
      if (uri == null) { result.put("available", false); call.resolve(result); return; }
      ByteArrayOutputStream output = new ByteArrayOutputStream();
      try (InputStream input = getContext().getContentResolver().openInputStream(uri)) { if (input == null) throw new Exception("Não foi possível ler o arquivo recebido."); byte[] buffer = new byte[16384]; int read; int total = 0; while ((read = input.read(buffer)) >= 0) { total += read; if (total > 120 * 1024 * 1024) throw new Exception("Arquivo maior que 120 MB."); output.write(buffer, 0, read); } }
      result.put("available", true); result.put("name", displayName(uri)); result.put("mimeType", getContext().getContentResolver().getType(uri)); result.put("dataBase64", Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP));
      getActivity().setIntent(new Intent()); call.resolve(result);
    } catch (Exception error) { call.reject(error.getMessage(), error); }
  }

  @Override
  protected void handleOnDestroy() { executor.shutdownNow(); super.handleOnDestroy(); }
}
`;

await fs.writeFile(mainActivityPath, mainActivity, 'utf8');
await fs.writeFile(pluginPath, plugin, 'utf8');

let manifest = await fs.readFile(manifestPath, 'utf8');
if (!manifest.includes('android.intent.action.VIEW')) {
  const filter = `\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="content" />\n                <data android:scheme="file" />\n                <data android:mimeType="application/pdf" />\n                <data android:mimeType="application/zip" />\n                <data android:mimeType="application/epub+zip" />\n                <data android:mimeType="application/vnd.openxmlformats-officedocument.wordprocessingml.document" />\n                <data android:mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />\n                <data android:mimeType="text/*" />\n                <data android:mimeType="image/*" />\n            </intent-filter>\n            <intent-filter>\n                <action android:name="android.intent.action.SEND" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <data android:mimeType="*/*" />\n            </intent-filter>`;
  manifest = manifest.replace(/(\s*<\/activity>)/, `${filter}$1`);
  await fs.writeFile(manifestPath, manifest, 'utf8');
}

console.log('Android native bridge: Keystore AI, MediaStore Downloads and file intents configured.');
