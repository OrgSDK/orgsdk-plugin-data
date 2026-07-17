import type { SafeFunction } from "@orgsdk/plugins";
import { safeFunctions as currencyFns } from "./currency-functions";
import { safeFunctions as dataFetchFns } from "./data-fetch";
import { safeFunctions as dataOpsFns } from "./data-operations";
import { safeFunctions as dataProcessingFns } from "./data-processing";
import { safeFunctions as dataUtilsFns } from "./data-utils";
import { safeFunctions as documentFns } from "./document-functions";

export const safeFunctions: SafeFunction[] = [
	...currencyFns,
	...dataFetchFns,
	...dataOpsFns,
	...dataProcessingFns,
	...dataUtilsFns,
	...documentFns,
];
