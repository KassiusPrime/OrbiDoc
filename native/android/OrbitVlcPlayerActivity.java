package app.orbidoc.workspace;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.SurfaceView;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;
import android.graphics.Color;

import org.videolan.libvlc.LibVLC;
import org.videolan.libvlc.Media;
import org.videolan.libvlc.MediaPlayer;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Random;

public final class OrbitVlcPlayerActivity extends Activity implements MediaPlayer.EventListener {
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final Random random = new Random();
  private LibVLC libVlc;
  private MediaPlayer mediaPlayer;
  private SurfaceView surfaceView;
  private TextView titleView;
  private TextView timeView;
  private TextView audioPoster;
  private SeekBar seekBar;
  private Button playButton;
  private Button speedButton;
  private Button shuffleButton;
  private Button repeatButton;
  private ArrayList<String> playlist = new ArrayList<>();
  private int index = 0;
  private float rate = 1.0f;
  private boolean shuffle = false;
  private boolean repeat = false;
  private boolean userSeeking = false;
  private boolean isAudio = false;
  private boolean closing = false;

  private final Runnable ticker = new Runnable() {
    @Override public void run() {
      if (closing || mediaPlayer == null) return;
      long length = Math.max(0L, mediaPlayer.getLength());
      long time = Math.max(0L, mediaPlayer.getTime());
      if (!userSeeking && length > 0) seekBar.setProgress((int) Math.max(0L, Math.min(1000L, time * 1000L / length)));
      timeView.setText(formatTime(time) + " / " + (length > 0 ? formatTime(length) : "--:--"));
      playButton.setText(mediaPlayer.isPlaying() ? "Pausar" : "Reproduzir");
      handler.postDelayed(this, 400L);
    }
  };

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    String listTitle = getIntent().getStringExtra("media_title");
    ArrayList<String> inputList = getIntent().getStringArrayListExtra("media_uris");
    if (inputList != null) playlist.addAll(inputList);
    if (playlist.isEmpty()) {
      String single = getIntent().getStringExtra("media_uri");
      if (single != null && !single.trim().isEmpty()) playlist.add(single);
    }
    index = Math.max(0, Math.min(getIntent().getIntExtra("media_index", 0), Math.max(0, playlist.size() - 1)));
    if (playlist.isEmpty()) {
      finish();
      return;
    }
    createUi(listTitle);
    try {
      ArrayList<String> options = new ArrayList<>();
      options.add("--audio-time-stretch");
      options.add("--network-caching=1200");
      libVlc = new LibVLC(this, options);
      mediaPlayer = new MediaPlayer(libVlc);
      mediaPlayer.setEventListener(this);
      mediaPlayer.getVLCVout().setVideoView(surfaceView);
      mediaPlayer.getVLCVout().attachViews();
      openCurrent(listTitle);
      handler.post(ticker);
    } catch (Exception error) {
      timeView.setText("Falha ao iniciar o motor de mídia");
      playButton.setEnabled(false);
    }
  }

  private void createUi(String requestedTitle) {
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    FrameLayout root = new FrameLayout(this);
    root.setBackgroundColor(Color.rgb(8, 11, 17));
    LinearLayout column = new LinearLayout(this);
    column.setOrientation(LinearLayout.VERTICAL);
    column.setPadding(dp(12), dp(10), dp(12), dp(12));

    TextView overline = new TextView(this);
    overline.setText("ORBIT PLAYER  ·  LIBVLC");
    overline.setTextColor(Color.rgb(167, 139, 250));
    overline.setTextSize(10);
    column.addView(overline, new LinearLayout.LayoutParams(-1, -2));

    titleView = new TextView(this);
    titleView.setText(requestedTitle == null ? displayName(playlist.get(index)) : requestedTitle);
    titleView.setTextColor(Color.WHITE);
    titleView.setTextSize(17);
    titleView.setMaxLines(2);
    titleView.setGravity(Gravity.CENTER_VERTICAL);
    titleView.setPadding(0, dp(4), 0, dp(10));
    column.addView(titleView, new LinearLayout.LayoutParams(-1, -2));

    FrameLayout stage = new FrameLayout(this);
    stage.setBackgroundColor(Color.BLACK);
    LinearLayout.LayoutParams stageParams = new LinearLayout.LayoutParams(-1, 0, 1f);
    stageParams.bottomMargin = dp(12);
    column.addView(stage, stageParams);

    surfaceView = new SurfaceView(this);
    surfaceView.setBackgroundColor(Color.BLACK);
    stage.addView(surfaceView, new FrameLayout.LayoutParams(-1, -1));

    audioPoster = new TextView(this);
    audioPoster.setText("♫\n\nOrbit Player");
    audioPoster.setTextColor(Color.rgb(196, 181, 253));
    audioPoster.setTextSize(24);
    audioPoster.setGravity(Gravity.CENTER);
    audioPoster.setBackgroundColor(Color.rgb(13, 18, 32));
    stage.addView(audioPoster, new FrameLayout.LayoutParams(-1, -1));
    audioPoster.setVisibility(View.GONE);

    seekBar = new SeekBar(this);
    seekBar.setMax(1000);
    seekBar.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.rgb(124, 58, 237)));
    seekBar.setThumbTintList(android.content.res.ColorStateList.valueOf(Color.rgb(196, 181, 253)));
    column.addView(seekBar, new LinearLayout.LayoutParams(-1, dp(32)));
    seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
      @Override public void onProgressChanged(SeekBar bar, int progress, boolean fromUser) {
        if (fromUser && mediaPlayer != null) {
          long length = mediaPlayer.getLength();
          if (length > 0) timeView.setText(formatTime(length * progress / 1000L) + " / " + formatTime(length));
        }
      }
      @Override public void onStartTrackingTouch(SeekBar bar) { userSeeking = true; }
      @Override public void onStopTrackingTouch(SeekBar bar) {
        userSeeking = false;
        if (mediaPlayer != null && mediaPlayer.getLength() > 0) mediaPlayer.setTime(mediaPlayer.getLength() * bar.getProgress() / 1000L);
      }
    });

    timeView = new TextView(this);
    timeView.setTextColor(Color.rgb(156, 163, 175));
    timeView.setTextSize(11);
    timeView.setGravity(Gravity.CENTER);
    column.addView(timeView, new LinearLayout.LayoutParams(-1, dp(22)));

    LinearLayout rowOne = new LinearLayout(this);
    rowOne.setGravity(Gravity.CENTER);
    rowOne.setOrientation(LinearLayout.HORIZONTAL);
    addButton(rowOne, "Anterior", v -> previous());
    addButton(rowOne, "−10 s", v -> seekBy(-10000L));
    playButton = addButton(rowOne, "Reproduzir", v -> togglePlayback());
    addButton(rowOne, "+10 s", v -> seekBy(10000L));
    addButton(rowOne, "Próximo", v -> next(false));
    column.addView(rowOne, new LinearLayout.LayoutParams(-1, dp(48)));

    LinearLayout rowTwo = new LinearLayout(this);
    rowTwo.setGravity(Gravity.CENTER);
    rowTwo.setOrientation(LinearLayout.HORIZONTAL);
    shuffleButton = addButton(rowTwo, "Aleatório", v -> {
      shuffle = !shuffle;
      shuffleButton.setText(shuffle ? "Aleatório ✓" : "Aleatório");
    });
    repeatButton = addButton(rowTwo, "Repetir", v -> {
      repeat = !repeat;
      repeatButton.setText(repeat ? "Repetir ✓" : "Repetir");
    });
    speedButton = addButton(rowTwo, "1×", v -> cycleSpeed());
    addButton(rowTwo, "Tela cheia", v -> toggleFullscreen());
    addButton(rowTwo, "Fechar", v -> finish());
    column.addView(rowTwo, new LinearLayout.LayoutParams(-1, dp(48)));
    root.addView(column, new FrameLayout.LayoutParams(-1, -1));
    setContentView(root);
  }

  private Button addButton(LinearLayout row, String text, View.OnClickListener click) {
    Button button = new Button(this);
    button.setText(text);
    button.setTextSize(10);
    button.setAllCaps(false);
    button.setTextColor(Color.WHITE);
    button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(36, 45, 65)));
    button.setOnClickListener(click);
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(44), 1f);
    params.setMargins(dp(2), dp(2), dp(2), dp(2));
    row.addView(button, params);
    return button;
  }

  private void openCurrent(String requestedTitle) {
    if (mediaPlayer == null || playlist.isEmpty()) return;
    String location = playlist.get(index);
    isAudio = looksLikeAudio(location);
    surfaceView.setVisibility(isAudio ? View.GONE : View.VISIBLE);
    audioPoster.setVisibility(isAudio ? View.VISIBLE : View.GONE);
    titleView.setText(index == 0 && requestedTitle != null ? requestedTitle : displayName(location));
    try {
      Media media = new Media(libVlc, Uri.parse(location));
      media.addOption(":network-caching=1200");
      media.addOption(":file-caching=1000");
      mediaPlayer.setMedia(media);
      media.release();
      mediaPlayer.setRate(rate);
      mediaPlayer.play();
      timeView.setText("Carregando mídia…");
    } catch (Exception error) {
      timeView.setText("Não foi possível abrir esta mídia");
    }
  }

  private void togglePlayback() {
    if (mediaPlayer == null) return;
    if (mediaPlayer.isPlaying()) mediaPlayer.pause();
    else mediaPlayer.play();
  }

  private void seekBy(long offset) {
    if (mediaPlayer == null) return;
    long length = mediaPlayer.getLength();
    long target = Math.max(0L, mediaPlayer.getTime() + offset);
    if (length > 0) target = Math.min(length, target);
    mediaPlayer.setTime(target);
  }

  private void previous() {
    if (mediaPlayer != null && mediaPlayer.getTime() > 5000L) {
      mediaPlayer.setTime(0L);
      return;
    }
    if (playlist.size() > 1) {
      index = (index - 1 + playlist.size()) % playlist.size();
      openCurrent(null);
    }
  }

  private void next(boolean atEnd) {
    if (playlist.isEmpty()) return;
    if (atEnd && repeat) {
      mediaPlayer.setTime(0L);
      mediaPlayer.play();
      return;
    }
    if (playlist.size() == 1) {
      if (repeat) {
        mediaPlayer.setTime(0L);
        mediaPlayer.play();
      }
      return;
    }
    if (shuffle) {
      int candidate = index;
      while (candidate == index) candidate = random.nextInt(playlist.size());
      index = candidate;
    } else {
      if (atEnd && index == playlist.size() - 1) return;
      index = (index + 1) % playlist.size();
    }
    openCurrent(null);
  }

  private void cycleSpeed() {
    float[] speeds = new float[] {0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f, 3.0f, 4.0f};
    int found = 0;
    for (int i = 0; i < speeds.length; i++) if (Math.abs(speeds[i] - rate) < 0.01f) found = i;
    rate = speeds[(found + 1) % speeds.length];
    if (mediaPlayer != null) mediaPlayer.setRate(rate);
    speedButton.setText(String.valueOf(rate).replace(".0", "") + "×");
  }

  private void toggleFullscreen() {
    int currentFlags = getWindow().getDecorView().getSystemUiVisibility();
    int fullscreenFlags = View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
      View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
    getWindow().getDecorView().setSystemUiVisibility((currentFlags & View.SYSTEM_UI_FLAG_FULLSCREEN) != 0 ? View.SYSTEM_UI_FLAG_LAYOUT_STABLE : fullscreenFlags);
  }

  @Override public void onEvent(MediaPlayer.Event event) {
    if (event.type == MediaPlayer.Event.EndReached) runOnUiThread(() -> next(true));
    else if (event.type == MediaPlayer.Event.EncounteredError) runOnUiThread(() -> timeView.setText("Erro de leitura/codec. Tente outro arquivo."));
    else if (event.type == MediaPlayer.Event.Playing) runOnUiThread(() -> playButton.setText("Pausar"));
    else if (event.type == MediaPlayer.Event.Paused || event.type == MediaPlayer.Event.Stopped) runOnUiThread(() -> playButton.setText("Reproduzir"));
  }

  private String displayName(String source) {
    try {
      String path = Uri.parse(source).getLastPathSegment();
      if (path != null && !path.trim().isEmpty()) return Uri.decode(path);
    } catch (Exception ignored) {}
    return "Mídia do Orbit";
  }

  private boolean looksLikeAudio(String source) {
    String lower = source.toLowerCase(java.util.Locale.ROOT).split("\\\\?", 2)[0];
    return lower.matches(".*\\\\.(mp3|wav|ogg|flac|m4a|aac|opus|aiff|wma)(\\\\?.*)?$");
  }

  private String formatTime(long milliseconds) {
    long seconds = Math.max(0L, milliseconds / 1000L);
    long hours = seconds / 3600L;
    long minutes = (seconds % 3600L) / 60L;
    long remaining = seconds % 60L;
    if (hours > 0L) return String.format(java.util.Locale.ROOT, "%d:%02d:%02d", hours, minutes, remaining);
    return String.format(java.util.Locale.ROOT, "%d:%02d", minutes, remaining);
  }

  private int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density + 0.5f); }

  @Override protected void onPause() {
    super.onPause();
    if (mediaPlayer != null) mediaPlayer.pause();
  }

  @Override protected void onDestroy() {
    closing = true;
    handler.removeCallbacks(ticker);
    if (mediaPlayer != null) {
      mediaPlayer.setEventListener(null);
      mediaPlayer.stop();
      mediaPlayer.getVLCVout().detachViews();
      mediaPlayer.release();
      mediaPlayer = null;
    }
    if (libVlc != null) { libVlc.release(); libVlc = null; }
    super.onDestroy();
  }
}
