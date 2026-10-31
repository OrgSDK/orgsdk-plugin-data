import assert from "node:assert/strict";

const pdf =
	"JVBERi0xLjEKMSAwIG9iaiA8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4gZW5kb2JqCjIgMCBvYmogPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4gZW5kb2JqCjMgMCBvYmogPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA0IDAgUiA+PiA+PiAvQ29udGVudHMgNSAwIFIgL01lZGlhQm94IFswIDAgNjEyIDc5Ml0gPj4gZW5kb2JqCjQgMCBvYmogPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+IGVuZG9iago1IDAgb2JqIDw8IC9MZW5ndGggNDQgPj4gc3RyZWFtCkJUIC9GMSAxMiBUZiAxMDAgNzAwIFRkIChIZWxsbyBPcmdTREspIFRqIEVUCmVuZHN0cmVhbSBlbmRvYmoKeHJlZgowIDYKdHJhaWxlciA8PCAvUm9vdCAxIDAgUiAvU2l6ZSA2ID4+CnN0YXJ0eHJlZgowCiUlRU9G";
export default async function createFixture() {
	return {
		async fetch(request) {
			assert.equal(request.url, "https://data.invalid/fixture");
			assert.equal(request.method, "GET");
			return Response.json({ value: 42 });
		},
		async run(call) {
			assert.equal(
				(
					await call("convertCurrency", {
						amount: 100,
						fromCurrency: "USD",
						toCurrency: "AUD",
					})
				).convertedAmount,
				153,
			);
			assert.deepEqual(
				await call("fetchData", { url: "https://data.invalid/fixture" }),
				{ value: 42 },
			);
			assert.equal(await call("sumArray", { numbers: [1, 2, 3] }), 6);
			assert.deepEqual(
				await call("chunkArray", { array: [1, 2, 3], size: 2 }),
				[[1, 2], [3]],
			);
			assert.deepEqual(
				await call("uniqueBy", { array: [{ id: 1 }, { id: 1 }], key: "id" }),
				[{ id: 1 }],
			);
			assert.deepEqual(
				await call("groupBy", { array: [{ id: 1 }, { id: 1 }], key: "id" }),
				{ 1: [{ id: 1 }, { id: 1 }] },
			);
			assert.deepEqual(
				await call("processData", { data: [3, 1, 2], processor: "sort" }),
				[1, 2, 3],
			);
			assert.deepEqual(
				await call("transformData", {
					data: [{ name: "Example" }],
					transformer: "pluck",
					key: "name",
				}),
				["Example"],
			);
			assert.equal(
				(await call("saveResult", { key: "fixture", value: 42, storage: {} }))
					.saved,
				true,
			);
			assert.equal(
				(
					await call("validateData", {
						data: { name: "Example" },
						rules: { name: { required: true, type: "string" } },
					})
				).valid,
				true,
			);
			const parsed = await call("parsePdf", { base64Data: pdf });
			assert.equal(parsed.totalPages, 1);
			assert(parsed.text.includes("Hello OrgSDK"));
		},
	};
}
