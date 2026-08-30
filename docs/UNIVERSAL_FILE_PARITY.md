# OrbiDoc - Universal File parity target

## Product principle

OrbiDoc should feel like one coherent file workspace, not a collection of mini-apps. The user starts from a file, folder, connected service or creation flow. The product resolves the file family and exposes only the actions that make sense for that context.

The Universal File Opener & Editor reference is used for capability and information-architecture benchmarking, not for copying proprietary visuals, wording, branding or implementation.

Reference snapshots reviewed on 2026-08-30 report 36 file families and roughly 214-218 recognized extensions depending on the release/snapshot. OrbiDoc should prefer an honest registry over a marketing number: an extension is only marked complete when its real open/edit/convert/inspect path is validated.

## OrbiDoc differentiation

Universal file handling is the base layer. OrbiDoc adds:

- Google Drive, OneDrive, Microsoft/SharePoint/Teams and GitHub as file sources;
- save-back/version/conflict flows for connected sources;
- AI as a contextual capability over the current file, selection or workspace;
- local-first Android/PWA operation when a task does not require a connected service;
- OrbiDoc identity and a consistent adaptive shell across compact, medium and expanded windows.

## Information architecture

Primary navigation must stay small:

1. Início
2. Arquivos
3. Serviços
4. Recentes
5. Configurações

Inside Arquivos:

- Biblioteca - OrbiDoc projects and recent authored content;
- Dispositivo - local files, folders and packages;
- Formatos - searchable capability registry.

Apps are work modes, not primary navigation destinations. PDF/OCR, conversion and AI are contextual capabilities unless the user explicitly starts a creation flow.

## Capability layers

### A. Open-any-file contract

- Recognize the file by extension/MIME and, where possible, by package structure.
- Route known files to a dedicated reader/editor.
- Open ZIP-compatible packages as packages without executing their contents.
- If no family matches, try a bounded text preview and then a bounded hexadecimal preview.
- Never corrupt an unknown file by pretending it is text-editable.

### B. Specialist viewers

Target parity surfaces:

- JSON tree + source;
- Markdown rendered/source;
- code/text editor with find/replace, line numbers and encoding controls;
- SQLite table browser + read-only SELECT surface;
- font specimen/metadata/character coverage;
- X.509 certificate fields/fingerprints/public-key export;
- ICS calendar card and raw source;
- VCF contact card and raw source;
- EML structured headers/body/attachments;
- EPUB navigation/progress/read-aloud;
- unknown-file hex search and checksums.

### C. Archives and packages

Current complete path: ZIP and ZIP-compatible packages supported by JSZip.

Target additions:

- TAR and gzip/bzip/xz wrappers;
- 7z, including password support where the chosen codec permits;
- classic RAR support if a safe redistributable engine is available;
- selective extraction, search and nested open;
- zip-slip/path traversal rejection;
- atomic save/copy and interruption recovery.

RAR5/split RAR or any unsupported variant must be refused explicitly rather than shown as a broken archive.

### D. PDF

Target professional parity:

- markup palette;
- fill/sign;
- in-place text editing where technically safe;
- OCR and searchable scan text;
- page manager/reorder/rotate/crop/delete/insert;
- combine/split/images-to-PDF;
- redaction that removes underlying content;
- password/protection/compression;
- forms;
- find, reading view, word count, read aloud;
- undo/redo and recoverable unsaved sessions.

### E. Word / OpenDocument

Target:

- native caret/page canvas;
- Home, Insert, Layout, Review and contextual Table/Picture commands;
- text/paragraph styles, tables, images and document structure;
- headers/footers, sections, page setup;
- find/replace;
- comments/review and existing tracked-change accept/reject;
- DOCX/DOCM/DOTX and ODT/OTT fidelity;
- honest read-only/conversion route for legacy DOC/RTF where full editing is unavailable.

### F. Spreadsheet

Target:

- real workbook grid and sheet tabs;
- formula entry/evaluation;
- formatting, borders, number formats and conditional formatting;
- rows/columns/sheets, freeze panes, sorting/filtering;
- validation, tables, charts and pivots where feasible;
- XLSX/XLSM/XLTX, CSV/TSV and ODS/OTS;
- legacy XLS read/convert path;
- large-sheet virtualization and bounded memory use.

### G. Presentation

Target:

- slide rendering as slides, not extracted text only;
- on-slide text editing;
- images, notes, charts and supported shapes;
- slide manager/order/duplicate/delete;
- layouts, masters/themes and speaker notes;
- present mode;
- PPTX/PPTM/PPSX/POTX and ODP/OTP;
- legacy PPT read/convert path.

### H. Images

OrbiDoc already has a broad ImageMagick/WASM input/output layer. Target UI parity should consolidate it into one image surface:

- crop/resize/canvas;
- adjust/filter;
- draw/text/shapes;
- blur/pixelate;
- borders/watermark;
- metadata inspect/remove;
- OCR/read text;
- batch conversion;
- GIF creation;
- honest warnings for animation/multipage flattening and RAW limitations.

### I. Audio and video

Target:

- playback, seek and speed;
- metadata;
- trim;
- combine compatible clips;
- rotate/video-speed copies where supported;
- extract/remove audio;
- frame export;
- subtitle side-load for common subtitle formats;
- explicit codec capability detection per platform.

### J. File manager

Target:

- system picker + user-granted folder access;
- approved-folder browsing;
- create folder, rename, move, copy, delete;
- recents, favorites, search and filters;
- thumbnails and file metadata;
- safe Downloads handoff on Android;
- no implicit broad storage permission.

### K. Connected services

OrbiDoc-specific parity layer:

- Google Drive / Shared Drives;
- OneDrive / SharePoint / Teams files through Microsoft Graph;
- GitHub App for private repositories and write operations;
- source-aware open, save-back, save-copy and version conflict handling;
- no personal access token persisted in browser storage.

## Definition of done for a file family

A family is only marked complete when:

1. valid files open on web/PWA and Android where the platform supports the format;
2. malformed/oversized files fail with bounded, readable errors;
3. edit/save does not silently discard unsupported structure;
4. Save As never overwrites the original unexpectedly;
5. interrupted/competing writes have a recovery/conflict path;
6. accessibility, compact/medium/expanded layout and software keyboard are tested;
7. the capability registry matches the shipped behavior;
8. CI includes at least one regression contract for the family.

## Current priority

1. Finish open-any-file and honest capability registry.
2. Route editable DOCX/XLSX/PPTX/PDF from local/cloud sources directly to the matching editor.
3. Add source-aware save-back.
4. Add specialist viewers and archive codecs.
5. Deepen PDF/Office parity.
6. Add AI actions contextually after the underlying file operation works without AI.
