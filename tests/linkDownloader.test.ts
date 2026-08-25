import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filenameFromHeaders,
  inferDirectDownloadKind,
  normalizeDirectDownloadUrl,
  sanitizeDownloadFilename,
} from '../src/lib/linkDownloader';

test('direct downloader accepts normal HTTPS file URLs', () => {
  const url = normalizeDirectDownloadUrl('https://cdn.example.com/media/video.mp4?token=abc');
  assert.equal(url.protocol, 'https:');
  assert.equal(url.pathname, '/media/video.mp4');
});

test('direct downloader rejects unsupported protocols and streaming manifests', () => {
  assert.throws(() => normalizeDirectDownloadUrl('file:///tmp/video.mp4'), /HTTP ou HTTPS/i);
  assert.throws(() => normalizeDirectDownloadUrl('https://example.com/master.m3u8'), /streaming/i);
  assert.throws(() => normalizeDirectDownloadUrl('https://example.com/manifest.mpd'), /streaming/i);
});

test('direct downloader classifies common image, video and audio files', () => {
  assert.equal(inferDirectDownloadKind('https://example.com/photo.webp'), 'image');
  assert.equal(inferDirectDownloadKind('https://example.com/movie.mp4'), 'video');
  assert.equal(inferDirectDownloadKind('https://example.com/music.mp3'), 'audio');
  assert.equal(inferDirectDownloadKind('https://example.com/unknown.bin', 'application/pdf'), 'document');
});

test('download filenames are sanitized and may come from content-disposition', () => {
  assert.equal(sanitizeDownloadFilename('relatório:final?.pdf'), 'relatório_final_.pdf');
  assert.equal(filenameFromHeaders('https://example.com/fallback.bin', 'attachment; filename="arquivo.mp3"'), 'arquivo.mp3');
  assert.equal(filenameFromHeaders('https://example.com/relatorio.pdf'), 'relatorio.pdf');
});
