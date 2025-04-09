import * as crypto from "node:crypto";

export function generateRandomPassword(length: number): string {
	const charset =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	return Array.from(crypto.randomFillSync(new Uint8Array(length)))
		.map((n) => charset[n % charset.length])
		.join("");
}
