/**
 * Digital Asset Links: Damit öffnen Einladungs-QR-Codes (/r/CODE) direkt in der Handy-App,
 * statt im Browser. Android lädt diese Datei beim Installieren der App und prüft den Signier-Schlüssel.
 *
 * Standard ist der Fingerabdruck des Sideload-Schlüssels aus android-tv/signing/. Wer die App mit einem
 * eigenen Schlüssel baut (GitHub-Secret CINEMOOD_KEYSTORE_B64), trägt dessen SHA-256 in ANDROID_CERT_SHA256 ein
 * (mehrere durch Komma getrennt).
 */
const SIDELOAD_CERT = "1E:C3:3D:93:C4:49:D2:57:03:3E:B1:F6:42:EF:09:0A:C0:D6:9C:D1:53:C0:F8:80:B7:79:2D:EA:05:04:AE:B1";

export function GET() {
  const certs = (process.env.ANDROID_CERT_SHA256 || SIDELOAD_CERT)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
  return Response.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: "app.cinemood.handy", sha256_cert_fingerprints: certs },
      },
    ],
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
