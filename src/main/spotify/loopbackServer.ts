import http from "node:http";
import { SPOTIFY_REDIRECT_PORT } from "../../shared/constants";

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

const SUCCESS_HTML =
  "<html><body style=\"font-family:sans-serif;text-align:center;padding-top:4rem\">" +
  "<h2>Spotify connected</h2><p>You can close this tab and return to Desktop Pet.</p>" +
  "</body></html>";

const FAILURE_HTML =
  "<html><body style=\"font-family:sans-serif;text-align:center;padding-top:4rem\">" +
  "<h2>Spotify login failed</h2><p>You can close this tab and try again from Desktop Pet.</p>" +
  "</body></html>";

/**
 * Starts a one-shot loopback HTTP server, resolves with the `code` query param
 * once Spotify redirects back to /callback with a matching `state`.
 */
export function waitForOAuthCallback(expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${SPOTIFY_REDIRECT_PORT}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }

      const error = url.searchParams.get("error");
      const returnedState = url.searchParams.get("state");
      const code = url.searchParams.get("code");

      if (error || returnedState !== expectedState || !code) {
        res.writeHead(400, { "Content-Type": "text/html" }).end(FAILURE_HTML);
        settle(() => reject(new Error(error ?? "State mismatch or missing code")));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" }).end(SUCCESS_HTML);
      settle(() => resolve(code));
    });

    const timeout = setTimeout(() => {
      settle(() => reject(new Error("Login timed out")));
    }, CALLBACK_TIMEOUT_MS);

    function settle(action: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      server.close();
      action();
    }

    server.on("error", (err) => settle(() => reject(err)));
    server.listen(SPOTIFY_REDIRECT_PORT, "127.0.0.1");
  });
}
