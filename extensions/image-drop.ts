/**
 * @fileoverview
 * Pi extension that converts terminal-dropped local image paths into actual
 * image attachments while displaying compact numbered placeholders in the
 * interactive prompt editor.
 *
 * The extension handles both raw terminal paste input (for immediate editor
 * replacement) and Pi's interactive input event (for final attachment
 * resolution). It intentionally ignores unsupported, unreadable, invalid, and
 * oversized files rather than changing the user's prompt text.
 *
 * Supported formats: PNG, JPEG, GIF, WebP, and BMP.
 *
 * @module image-drop
 */
import { access, readFile, realpath, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";

/** A parsed terminal token and its source range in the original input. */
interface Token {
	start: number;
	end: number;
	value: string;
}

/** Result returned by Pi's image processing pipeline. */
interface ProcessImageResult {
	ok: boolean;
	data?: string;
	mimeType?: string;
	hints?: string[];
}

/** Compatible signature for Pi's internal image processing function. */
type ProcessImage = (
	bytes: Uint8Array,
	mimeType: string,
	options?: { autoResizeImages?: boolean },
) => Promise<ProcessImageResult>;

const MAX_IMAGE_FILE_BYTES = 50 * 1024 * 1024;

let processImagePromise: Promise<ProcessImage> | undefined;

/** Load Pi's own image conversion/resizing pipeline without relying on a fixed install prefix. */
function getProcessImage(): Promise<ProcessImage> {
	if (!processImagePromise) {
		processImagePromise = (async () => {
			const candidates: string[] = [];

			// In normal terminal use, argv[1] resolves to Pi's dist/cli.js.
			if (process.argv[1]) {
				try {
					const executable = await realpath(process.argv[1]);
					candidates.push(resolve(dirname(executable), "utils/image-process.js"));
				} catch {
					// Fall through to module resolution (useful for embedded Pi runtimes).
				}
			}

			try {
				const require = createRequire(import.meta.url);
				const packageEntry = require.resolve("@earendil-works/pi-coding-agent");
				candidates.push(resolve(dirname(packageEntry), "utils/image-process.js"));
			} catch {
				// The extension loader can resolve Pi even when native require cannot.
			}

			for (const candidate of candidates) {
				try {
					await access(candidate);
					const imageModule = (await import(pathToFileURL(candidate).href)) as { processImage: ProcessImage };
					return imageModule.processImage;
				} catch {
					// Try the next candidate.
				}
			}
			throw new Error("Could not locate Pi's image processor");
		})();
	}
	return processImagePromise;
}

/** Split terminal input like a shell, preserving source spans for replacements. */
export function tokenizeTerminalInput(text: string): Token[] {
	const tokens: Token[] = [];
	let index = 0;

	while (index < text.length) {
		while (text[index] === " " || text[index] === "\t" || text[index] === "\r" || text[index] === "\n") index++;
		if (index >= text.length) break;

		const start = index;
		let value = "";
		let quote: "'" | '"' | undefined;

		while (index < text.length) {
			const char = text[index]!;
			if (!quote && (char === " " || char === "\t" || char === "\r" || char === "\n")) break;
			if (char === "\\" && quote !== "'") {
				if (index + 1 < text.length) {
					value += text[index + 1]!;
					index += 2;
					continue;
				}
			}
			if (char === "'" || char === '"') {
				if (!quote) {
					quote = char;
					index++;
					continue;
				}
				if (quote === char) {
					quote = undefined;
					index++;
					continue;
				}
			}
			value += char;
			index++;
		}

		tokens.push({ start, end: index, value });
	}

	return tokens;
}

/** Convert a token into a supported local absolute path. */
function localPathFromToken(value: string): string | undefined {
	let candidate = value;
	if (candidate.startsWith("file://")) {
		try {
			candidate = fileURLToPath(candidate);
		} catch {
			return undefined;
		}
	}
	if (candidate.startsWith("~/")) candidate = resolve(homedir(), candidate.slice(2));
	if (!candidate.startsWith("/")) return undefined;
	return candidate;
}

/** Detect supported image formats from file signatures rather than extensions. */
function detectImageMimeType(bytes: Uint8Array): string | undefined {
	const startsWith = (signature: number[], offset = 0) =>
		signature.every((byte, index) => bytes[offset + index] === byte);

	if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
	if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
	if (bytes.length >= 6 && Buffer.from(bytes.subarray(0, 3)).toString("ascii") === "GIF") return "image/gif";
	if (
		bytes.length >= 12 &&
		Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
		Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
	) {
		return "image/webp";
	}
	if (startsWith([0x42, 0x4d])) return "image/bmp";
	return undefined;
}

/** Read, validate, and process one local image file for model submission. */
async function imageFromPath(filePath: string): Promise<ImageContent | undefined> {
	try {
		const fileStat = await stat(filePath);
		if (!fileStat.isFile() || fileStat.size === 0 || fileStat.size > MAX_IMAGE_FILE_BYTES) return undefined;
		const bytes = await readFile(filePath);
		const detectedMimeType = detectImageMimeType(bytes);
		if (!detectedMimeType) return undefined;

		const processImage = await getProcessImage();
		const processed = await processImage(bytes, detectedMimeType, { autoResizeImages: true });
		if (!processed.ok || !processed.data || !processed.mimeType) return undefined;
		return { type: "image", data: processed.data, mimeType: processed.mimeType };
	} catch {
		return undefined;
	}
}

/** Image processing state associated with an editor placeholder. */
interface PendingEditorImage {
	originalText: string;
	image: Promise<ImageContent | undefined>;
}

/**
 * Convert terminal-dropped image paths into Pi image attachments.
 *
 * Standalone dropped paths are replaced immediately in the TUI editor with
 * numbered placeholders. The corresponding image is resolved when the input
 * is submitted, while paths embedded in ordinary prompt text are handled by
 * the submit-time input transform.
 */
export default function imageDropExtension(pi: ExtensionAPI) {
	const pendingEditorImages = new Map<number, PendingEditorImage>();
	let nextEditorImageId = 1;

	pi.on("session_start", (_event, ctx) => {
		pendingEditorImages.clear();
		nextEditorImageId = 1;
		if (ctx.mode !== "tui") return;

		ctx.ui.onTerminalInput((data) => {
			const bracketed = data.match(/^\x1b\[200~([\s\S]*)\x1b\[201~$/);
			const pastedText = bracketed?.[1] ?? (data.length > 1 && !data.includes("\x1b") ? data : undefined);
			if (pastedText === undefined) return;

			const tokens = tokenizeTerminalInput(pastedText);
			if (tokens.length !== 1) return;
			const token = tokens[0]!;
			if (pastedText.slice(0, token.start).trim() || pastedText.slice(token.end).trim()) return;
			const filePath = localPathFromToken(token.value);
			if (!filePath || !/\.(?:png|jpe?g|gif|webp|bmp)$/iu.test(filePath)) return;

			const id = nextEditorImageId++;
			pendingEditorImages.set(id, { originalText: token.value, image: imageFromPath(filePath) });
			const replaced = pastedText.slice(0, token.start) + `[Image #${id}]` + pastedText.slice(token.end);
			return { data: bracketed ? `\x1b[200~${replaced}\x1b[201~` : replaced };
		});
	});

	pi.on("input", async (event) => {
		if (event.source !== "interactive") return { action: "continue" };

		let text = event.text;
		const editorImages: ImageContent[] = [];
		for (const match of [...text.matchAll(/\[Image #(\d+)\]/g)].toReversed()) {
			const id = Number(match[1]);
			const pending = pendingEditorImages.get(id);
			if (!pending || match.index === undefined) continue;
			const image = await pending.image;
			pendingEditorImages.delete(id);
			if (image) {
				editorImages.unshift(image);
			} else {
				text = text.slice(0, match.index) + pending.originalText + text.slice(match.index + match[0].length);
			}
		}

		const attachments: Array<{ token: Token; image: ImageContent }> = [];
		for (const token of tokenizeTerminalInput(text)) {
			const filePath = localPathFromToken(token.value);
			if (!filePath) continue;
			const image = await imageFromPath(filePath);
			if (image) attachments.push({ token, image });
		}

		pendingEditorImages.clear();
		nextEditorImageId = 1;
		if (attachments.length === 0 && editorImages.length === 0 && text === event.text) {
			return { action: "continue" };
		}

		const existingImageCount = (event.images?.length ?? 0) + editorImages.length;
		for (let index = attachments.length - 1; index >= 0; index--) {
			const attachment = attachments[index]!;
			const replacement = `[Image #${existingImageCount + index + 1}]`;
			text = text.slice(0, attachment.token.start) + replacement + text.slice(attachment.token.end);
		}

		return {
			action: "transform",
			text,
			images: [...(event.images ?? []), ...editorImages, ...attachments.map(({ image }) => image)],
		};
	});
}
