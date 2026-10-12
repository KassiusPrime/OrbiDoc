  @PluginMethod
  public void supportsNativeVlcPlayer(PluginCall call) {
    JSObject result = new JSObject();
    result.put("available", true);
    result.put("engine", "LibVLC");
    result.put("version", "3.6.1");
    call.resolve(result);
  }

  @PluginMethod
  public void playWithLibVlc(PluginCall call) {
    String url = call.getString("url", "").trim();
    if (!url.startsWith("https://")) {
      call.reject("O reprodutor nativo exige uma URL HTTPS direta. Para URLs com HTTP ou páginas comuns, use o reprodutor web.");
      return;
    }
    Intent intent = new Intent(getActivity(), OrbitVlcPlayerActivity.class);
    intent.putExtra("media_uri", url);
    intent.putExtra("media_title", call.getString("title", "Mídia do Orbit"));
    getActivity().startActivity(intent);
    call.resolve();
  }

  @PluginMethod
  public void pickAndPlayWithLibVlc(PluginCall call) {
    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("*/*");
    intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {"video/*", "audio/*", "application/octet-stream"});
    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
    startActivityForResult(call, intent, "onVlcMediaPicked");
  }

  @ActivityCallback
  private void onVlcMediaPicked(PluginCall call, ActivityResult result) {
    if (call == null) return;
    if (result == null || result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null) {
      call.resolve();
      return;
    }
    Intent data = result.getData();
    java.util.ArrayList<String> uris = new java.util.ArrayList<>();
    android.content.ClipData clips = data.getClipData();
    if (clips != null) {
      for (int i = 0; i < clips.getItemCount(); i++) {
        Uri uri = clips.getItemAt(i).getUri();
        if (uri != null) uris.add(uri.toString());
      }
    } else if (data.getData() != null) {
      uris.add(data.getData().toString());
    }
    if (uris.isEmpty()) { call.resolve(); return; }
    Intent player = new Intent(getActivity(), OrbitVlcPlayerActivity.class);
    player.putStringArrayListExtra("media_uris", uris);
    player.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    getActivity().startActivity(player);
    call.resolve();
  }
