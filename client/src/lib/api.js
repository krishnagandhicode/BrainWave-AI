const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

const API_URL = rawApiUrl.trim().replace(/\/+$/, "");

export const buildApiUrl = (path = "") => {
	const normalizedPath = String(path || "").startsWith("/")
		? String(path || "")
		: `/${String(path || "")}`;

	const fullUrl = `${API_URL}${normalizedPath}`;
	// console.log(`Built API URL: ${fullUrl}`);
	return fullUrl;
};

export const getResponseError = async (
	response,
	fallbackMessage = "Request failed"
) => {
	const contentType = response.headers.get("content-type") || "";

	if (contentType.includes("application/json")) {
		const payload = await response.json().catch(() => null);
		return payload?.error || payload?.message || fallbackMessage;
	}

	const text = await response.text().catch(() => "");

	if (/<!doctype html|<html/i.test(text)) {
		return fallbackMessage;
	}

	return text || fallbackMessage;
};

export default API_URL;
