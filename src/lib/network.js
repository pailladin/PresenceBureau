const fs = require("node:fs");

function configureNetworkForNode() {
  try {
    const { Agent, ProxyAgent, setGlobalDispatcher } = require("undici");
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const certPath = process.env.NODE_EXTRA_CA_CERTS;
    let certPem = null;

    if (certPath) {
      try {
        certPem = fs.readFileSync(certPath, "utf8");
        console.log("Certificat CA chargé pour fetch:", certPath);
      } catch (error) {
        console.warn("Impossible de lire NODE_EXTRA_CA_CERTS:", certPath, error.message);
      }
    }

    if (proxyUrl) {
      // If your proxy requires authentication, HTTP 407 may still occur.
      setGlobalDispatcher(new ProxyAgent(proxyUrl));
      console.log("Proxy HTTP(S) activé pour fetch:", proxyUrl);
      return;
    }

    if (certPem) {
      setGlobalDispatcher(
        new Agent({
          connect: {
            ca: certPem,
          },
        })
      );
      console.log("Agent fetch configuré avec certificat CA personnalisé.");
    }
  } catch (error) {
    console.warn("Impossible de configurer le réseau Node pour fetch:", error.message);
  }
}

module.exports = { configureNetworkForNode };
