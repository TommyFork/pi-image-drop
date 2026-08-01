# pi-image-drop

[![npm version](https://img.shields.io/npm/v/pi-image-drop)](https://www.npmjs.com/package/pi-image-drop)
[![Pi package](https://img.shields.io/badge/Pi-package-7c3aed)](https://pi.dev/packages/pi-image-drop)
[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A Pi coding-agent extension for macOS terminal workflows. Drop an image file into the Pi prompt and it is displayed as `[Image #1]` while you write, then submitted as a real image attachment instead of a raw file path.

## Features

- Converts terminal-dropped local image paths into image attachments.
- Shows numbered placeholders such as `[Image #1]` in the prompt editor before submission.
- Supports multiple images and preserves surrounding prompt text.
- Handles macOS shell escaping, quotes, spaces, Unicode spaces, tabs, and multiline input.
- Supports PNG, JPEG, GIF, WebP, and BMP files.
- Ignores missing, unreadable, invalid, empty, or over-50-MB files.
- Uses Pi's image resize/conversion pipeline when available.

## Requirements

- [Pi coding agent](https://github.com/earendil-works/pi) with extension support.
- A terminal that provides dropped file paths, such as macOS Terminal, iTerm2, or Ghostty.
- A Pi version with `ctx.ui.onTerminalInput()` and image input support.

## Install

Install the published package through Pi:

```bash
pi install npm:pi-image-drop
```

Try the latest package for one run without changing your settings:

```bash
pi -e npm:pi-image-drop
```

Pin a reviewed npm release in shared configuration:

```bash
pi install npm:pi-image-drop@0.1.0
```

You can also install directly from GitHub:

```bash
pi install git:github.com/TommyFork/pi-image-drop
```

After installing, restart Pi or run `/reload`.

## Install from a local checkout

```bash
git clone https://github.com/TommyFork/pi-image-drop.git
cd pi-image-drop
pi install .
```

For development or review without installing:

```bash
pi -e ./extensions/image-drop.ts
```

## Usage

1. Start Pi with the extension installed.
2. Drag an image file into the prompt editor.
3. The dropped path should immediately become `[Image #1]`.
4. Add text or more images as needed.
5. Submit the prompt. Pi receives the images as attachments.

A dropped path that cannot be read or processed remains ordinary text when submitted.

## Security and privacy

Pi extensions execute with the permissions of the current user. Review the source before installing third-party extensions.

This extension reads only image paths supplied through terminal input and does not upload images itself. The resulting attachment is sent wherever the active Pi model/provider sends user input. Files are limited to 50 MB and are validated by their contents before processing.

## Limitations

- Image processing currently uses Pi's internal `utils/image-process.js` module, which is not a stable public extension API and may require updates as Pi changes.
- Immediate editor replacement is designed for a dropped path supplied as a standalone terminal paste. Recognizable paths embedded in ordinary prose are handled when the prompt is submitted.
- The current implementation targets local absolute paths, `~/...`, and `file://...` URLs.
- The extension currently supports PNG, JPEG, GIF, WebP, and BMP files.

## Development

The extension is loaded directly as TypeScript by Pi and has no build step.

```bash
git clone https://github.com/TommyFork/pi-image-drop.git
cd pi-image-drop
pi -e ./extensions/image-drop.ts
```

Before opening a pull request, verify the package contents:

```bash
npm pack --dry-run
```

## Contributing

Issues and pull requests are welcome at [github.com/TommyFork/pi-image-drop](https://github.com/TommyFork/pi-image-drop). Please include the Pi version, terminal application, operating system version, and a minimal reproduction for parsing or attachment problems.

## License

MIT
