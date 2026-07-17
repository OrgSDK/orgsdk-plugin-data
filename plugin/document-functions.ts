import type { SafeFunction } from "@orgsdk/plugins";
import { extractText, getMeta } from "unpdf";

export const moduleDescription =
	"Extract text and metadata from documents (PDF)";

export const safeFunctions: SafeFunction[] = [
	{
		name: "parsePdf",
		handler: async ({
			base64Data,
		}: {
			base64Data: string;
		}): Promise<{
			text: string;
			totalPages: number;
			metadata?: Record<string, string>;
		}> => {
			if (typeof base64Data !== "string" || !base64Data) {
				throw new Error("parsePdf: base64Data is required");
			}

			const buffer = Buffer.from(base64Data, "base64");
			const data = new Uint8Array(buffer);

			const { text, totalPages } = await extractText(data, {
				mergePages: true,
			});

			let metadata: Record<string, string> | undefined;
			try {
				const meta = await getMeta(data);
				const info = meta.info ?? {};
				const picked: Record<string, string> = {};
				for (const key of [
					"Title",
					"Author",
					"Subject",
					"Creator",
					"Producer",
				]) {
					if (typeof info[key] === "string" && info[key]) {
						picked[key.toLowerCase()] = info[key];
					}
				}
				if (Object.keys(picked).length > 0) metadata = picked;
			} catch {
				// metadata extraction is best-effort
			}

			return {
				text: text as string,
				totalPages,
				...(metadata ? { metadata } : {}),
			};
		},
		description:
			"Extract text content and metadata from a PDF. Accepts standard base64 string (e.g. from getMessageAttachment().dataBase64). Returns full text, page count, and optional metadata.",
		returnType:
			"Promise<{ text: string; totalPages: number; metadata?: { title?: string; author?: string; subject?: string; creator?: string; producer?: string } }>",
		parameters: [{ name: "base64Data", type: "string" }],
		metadata: {
			category: "data",
			tags: ["readonly"],
			readonly: true,
			version: "1.0.0",
			relatedTo: ["getMessageAttachment"],
		},
		docs: {
			summary:
				"Extract text content and metadata from a PDF document. Accepts a standard base64-encoded string — the same format returned by getMessageAttachment().dataBase64.",
			parameters: [
				{
					name: "base64Data",
					type: "string",
					description:
						"Standard base64-encoded PDF bytes. Pass the dataBase64 field from getMessageAttachment() directly.",
					example: '"JVBERi0xLjQK..."',
				},
			],
			returns: {
				type: "Promise<{ text: string; totalPages: number; metadata?: Record<string, string> }>",
				description:
					"Extracted text (all pages merged), total page count, and optional PDF metadata (title, author, subject, creator, producer).",
				example:
					'{ text: "Invoice #1234\\nDate: 2026-01-15\\nAmount: $500.00", totalPages: 2, metadata: { title: "Invoice", author: "Acme Corp" } }',
			},
			examples: [
				{
					title: "Extract text from a Gmail PDF attachment",
					code: `const msgs = await gmail.getMessages("has:attachment", 5);
const msg = msgs[0];
const pdfRef = msg.attachments?.find(a => a.filename.endsWith(".pdf"));
if (pdfRef) {
  const attachment = await gmail.getMessageAttachment(msg.id, pdfRef.attachmentId);
  const pdf = await data.parsePdf(attachment.dataBase64);
  pdf.text;
}`,
					description:
						"Full chain: find email with attachment, download it, extract text",
				},
			],
			caveats: [
				"Scanned/image-only PDFs will return empty or minimal text — OCR is not supported",
				"Very large PDFs may be slow; consider processing only the attachments you need",
			],
			seeAlso: ["getMessageAttachment", "getMessage"],
		},
	},
];
