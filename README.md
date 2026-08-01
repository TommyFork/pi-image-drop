# pi-image-drop

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

## Install from GitHub

Try it for one run:

```bash
pi -e git:github.com/TommyFork/pi-image-drop
```

Install it globally:

```bash
pi install git:github.com/TommyFork/pi-image-drop
```

Pin a reviewed release or commit in shared configuration:

```bash
pi install git:github.com/TommyFork/pi-image-drop@v0.1.0
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

## License

MIT
