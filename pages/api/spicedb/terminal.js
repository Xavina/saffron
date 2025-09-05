import { spawn } from "node:child_process";

/**
 * Very small tokenizer: splits on spaces unless inside double quotes.
 * Example: `zed permission check "document:read me" view user:alice`
 */
function splitArgs(cmd) {
    const re = /[^\s"]+|"([^"]*)"/g;
    const out = [];
    let m;
    while ((m = re.exec(cmd)) !== null) {
        out.push(m[1] !== undefined ? m[1] : m[0]);
    }
    return out;
}

function hasDangerousChars(s) {
    // prevent attempts to escape into the shell even though we use execFile/spawn
    return /[;&|><`$]/.test(s);
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const { command } = req.body || {};
    if (typeof command !== "string" || !command.trim()) {
        return res.status(400).json({ ok: false, error: "Command is required" });
    }

    if (hasDangerousChars(command)) {
        return res.status(400).json({ ok: false, error: "Disallowed characters in command" });
    }

    const tokens = splitArgs(command.trim());
    if (tokens[0] !== "zed") {
        return res.status(400).json({ ok: false, error: 'Command must start with "zed"' });
    }

    // TODO: lock this down further by whitelisting subcommands:
    // const allowed = new Set(["schema", "permission", "relationship", "debug", "version"]);
    // if (!allowed.has(tokens[1])) { ... }

    // Inject endpoint/token if provided by env and not already present
    const args = tokens.slice(1);
    const hasEndpoint = args.includes("--endpoint");
    const hasToken = args.includes("--token");
    const injected = [...args];

    const endpoint = process.env.SPICEDB_ENDPOINT;
    const token = process.env.SPICEDB_TOKEN;
    const insecure = process.env.SPICEDB_INSECURE === "true";

    if (!hasEndpoint && endpoint) {
        injected.push("--endpoint", endpoint);
    }
    if (!hasToken && token) {
        injected.push("--token", token);
    }
    if (insecure && !injected.includes("--insecure")) {
        injected.push("--insecure");
    }

    const startedAt = Date.now();

    try {
        const child = spawn("zed", injected, {
            stdio: ["ignore", "pipe", "pipe"],
            env: process.env, // inherit env so zed can also use ZED_* env vars if desired
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (d) => (stdout += d.toString()));
        child.stderr.on("data", (d) => (stderr += d.toString()));

        child.on("error", (err) => {
            return res
                .status(500)
                .json({ ok: false, code: null, stdout, stderr, error: err.message });
        });

        child.on("close", (code) => {
            const endedAt = Date.now();
            const payload = {
                ok: code === 0,
                code,
                stdout,
                stderr,
                startedAt: new Date(startedAt).toISOString(),
                endedAt: new Date(endedAt).toISOString(),
                durationMs: endedAt - startedAt,
            };
            // 2xx even on non-zero exit so client can show stderr nicely
            return res.status(200).json(payload);
        });
    } catch (err) {
        return res.status(500).json({
            ok: false,
            code: null,
            stdout: "",
            stderr: "",
            error: err?.message || "Failed to spawn zed",
        });
    }
}
