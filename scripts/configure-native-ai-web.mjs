import fs from 'node:fs/promises';
import path from 'node:path';

const pluginPath = path.resolve('android/app/src/main/java/app/orbidoc/workspace/OrbiDocNativePlugin.java');
let source = await fs.readFile(pluginPath, 'utf8');

const replacement = String.raw`  private String flattenAiMessages(JSArray messages) {
    StringBuilder prompt = new StringBuilder();
    for (int i = 0; i < messages.length(); i++) {
      JSONObject message = messages.optJSONObject(i);
      if (message == null) continue;
      prompt.append(message.optString("role", "user").toUpperCase())
        .append(": ")
        .append(message.optString("content", ""))
        .append("\n\n");
    }
    return prompt.toString();
  }

  private String extractGeminiInteractionText(JSONObject root) {
    String answer = root.optString("output_text", "").trim();
    StringBuilder sources = new StringBuilder();
    JSONArray steps = root.optJSONArray("steps");
    if (steps != null) {
      for (int i = 0; i < steps.length(); i++) {
        JSONObject step = steps.optJSONObject(i);
        if (step == null || !"model_output".equals(step.optString("type"))) continue;
        JSONArray content = step.optJSONArray("content");
        if (content == null) continue;
        for (int j = 0; j < content.length(); j++) {
          JSONObject block = content.optJSONObject(j);
          if (block == null || !"text".equals(block.optString("type"))) continue;
          if (answer.isEmpty()) answer = block.optString("text", "").trim();
          JSONArray annotations = block.optJSONArray("annotations");
          if (annotations == null) continue;
          for (int k = 0; k < annotations.length(); k++) {
            JSONObject annotation = annotations.optJSONObject(k);
            if (annotation == null || !"url_citation".equals(annotation.optString("type"))) continue;
            String url = annotation.optString("url", "");
            String title = annotation.optString("title", url);
            if (url.isEmpty() || sources.toString().contains("(" + url + ")")) continue;
            sources.append("- [").append(title.isEmpty() ? url : title).append("](").append(url).append(")\n");
          }
        }
      }
    }
    if (sources.length() > 0 && !answer.contains("### Fontes")) {
      answer += "\n\n### Fontes\n" + sources;
    }
    return answer.trim();
  }

  @PluginMethod
  public void aiComplete(PluginCall call) {
    String provider = call.getString("provider", "");
    String model = call.getString("model", "");
    JSArray messages = call.getArray("messages");
    Boolean requestedWeb = call.getBoolean("webSearch", false);
    boolean webSearch = Boolean.TRUE.equals(requestedWeb) || ("groq".equals(provider) && model.startsWith("groq/compound"));
    if (!allowed(provider) || model.isEmpty() || messages == null) { call.reject("Requisição de IA inválida."); return; }

    executor.execute(() -> {
      try {
        String key = apiKey(provider);
        if (key == null) throw new Exception("Configure a chave de " + provider + " no aparelho.");

        JSONObject request = new JSONObject();
        String url;
        String effectiveModel = model;

        if ("gemini".equals(provider)) {
          if (webSearch) {
            url = "https://generativelanguage.googleapis.com/v1beta/interactions";
            request.put("model", model);
            request.put("input", flattenAiMessages(messages));
            request.put("tools", new JSONArray().put(new JSONObject().put("type", "google_search")));
          } else {
            url = "https://generativelanguage.googleapis.com/v1beta/models/" + Uri.encode(model) + ":generateContent?key=" + Uri.encode(key);
            JSONArray parts = new JSONArray().put(new JSONObject().put("text", flattenAiMessages(messages)));
            request.put("contents", new JSONArray().put(new JSONObject().put("role", "user").put("parts", parts)));
          }
        } else {
          url = "groq".equals(provider)
            ? "https://api.groq.com/openai/v1/chat/completions"
            : "https://openrouter.ai/api/v1/chat/completions";

          if ("groq".equals(provider) && webSearch && !model.startsWith("groq/compound")) {
            effectiveModel = "groq/compound-mini";
          }

          request.put("model", effectiveModel);
          request.put("messages", new JSONArray(messages.toString()));
          request.put("temperature", 0.35);

          if ("groq".equals(provider) && webSearch) {
            request.put("citation_options", "enabled");
            request.put("compound_custom", new JSONObject().put(
              "tools",
              new JSONObject().put("enabled_tools", new JSONArray().put("web_search").put("visit_website"))
            ));
          }

          if ("openrouter".equals(provider) && webSearch) {
            JSONArray tools = new JSONArray();
            tools.put(new JSONObject()
              .put("type", "openrouter:web_search")
              .put("parameters", new JSONObject().put("max_results", 5).put("max_total_results", 10)));
            tools.put(new JSONObject()
              .put("type", "openrouter:web_fetch")
              .put("parameters", new JSONObject().put("engine", "openrouter").put("max_content_tokens", 12000)));
            request.put("tools", tools);
          }
        }

        HttpURLConnection conn = connection(url, "POST", provider, key);
        if ("gemini".equals(provider) && webSearch) conn.setRequestProperty("x-goog-api-key", key);
        writeJson(conn, request);
        String text = read(conn);
        int status = conn.getResponseCode();

        // New OpenRouter server tools require tool-calling support. If the selected
        // model rejects them, retry once with the broadly compatible legacy web plugin.
        if (status >= 400 && "openrouter".equals(provider) && webSearch) {
          request.remove("tools");
          request.put("plugins", new JSONArray().put(new JSONObject().put("id", "web").put("max_results", 5)));
          conn = connection(url, "POST", provider, key);
          writeJson(conn, request);
          text = read(conn);
          status = conn.getResponseCode();
        }

        if (status >= 400) {
          throw new Exception("Provedor respondeu HTTP " + status + ". " + text.substring(0, Math.min(360, text.length())));
        }

        JSONObject root = new JSONObject(text);
        String answer = "";

        if ("gemini".equals(provider)) {
          if (webSearch) {
            answer = extractGeminiInteractionText(root);
          } else {
            JSONArray candidates = root.optJSONArray("candidates");
            if (candidates != null && candidates.length() > 0) {
              JSONObject candidate = candidates.optJSONObject(0);
              JSONObject content = candidate == null ? null : candidate.optJSONObject("content");
              JSONArray parts = content == null ? null : content.optJSONArray("parts");
              if (parts != null) {
                for (int i = 0; i < parts.length(); i++) {
                  JSONObject part = parts.optJSONObject(i);
                  if (part != null) answer += part.optString("text", "");
                }
              }
            }
          }
        } else {
          JSONArray choices = root.optJSONArray("choices");
          if (choices != null && choices.length() > 0) {
            JSONObject choice = choices.optJSONObject(0);
            JSONObject message = choice == null ? null : choice.optJSONObject("message");
            if (message != null) answer = message.optString("content", "");
          }
        }

        if (answer.trim().isEmpty()) throw new Exception("Resposta vazia do provedor.");
        JSObject result = new JSObject();
        result.put("text", answer.trim());
        result.put("provider", provider);
        result.put("model", effectiveModel);
        result.put("webSearch", webSearch);
        call.resolve(result);
      } catch (Exception error) {
        call.reject(error.getMessage(), error);
      }
    });
  }

  private String safeName`;

const methodPattern = /  @PluginMethod\n  public void aiComplete\(PluginCall call\) \{[\s\S]*?\n  \}\n\n  private String safeName/;
if (!methodPattern.test(source)) {
  throw new Error('Não foi possível localizar aiComplete no Java nativo gerado.');
}
source = source.replace(methodPattern, replacement);

if (!source.includes('openrouter:web_search')) throw new Error('OpenRouter Web Search não foi injetado.');
if (!source.includes('groq/compound-mini')) throw new Error('Groq Compound não foi injetado.');
if (!source.includes('model.startsWith("groq/compound")')) throw new Error('Groq Compound não ativa pesquisa automaticamente.');
if (!source.includes('generativelanguage.googleapis.com/v1beta/interactions')) throw new Error('Gemini Google Search não foi injetado.');
if (!source.includes('Boolean requestedWeb = call.getBoolean("webSearch", false)')) throw new Error('Flag webSearch não foi injetada.');

await fs.writeFile(pluginPath, source, 'utf8');
console.log('Android native AI: real-time web search enabled for Gemini, Groq and OpenRouter; Groq Compound is always research-enabled.');
