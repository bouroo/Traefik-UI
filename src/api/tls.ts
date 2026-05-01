import { Hono } from 'hono';
import { config } from '../config';
import { authMiddleware } from '../auth/middleware';

const tls = new Hono();

tls.use('*', authMiddleware);

interface CertificateInfo {
  domain: string;
  sans: string[];
  notBefore: string | null;
  notAfter: string | null;
  issuer: string | null;
  serialNumber: string | null;
  isExpired: boolean;
}

// Parse ASN.1 DER encoded certificate to extract basic info
// This is a simplified parser for common certificate fields
function parseCertificateFields(pemCert: string): CertificateInfo {
  const result: CertificateInfo = {
    domain: '',
    sans: [],
    notBefore: null,
    notAfter: null,
    issuer: null,
    serialNumber: null,
    isExpired: false,
  };

  try {
    // Decode base64 certificate
    const base64Cert = pemCert
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\s/g, '');

    const binaryStr = atob(base64Cert);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Find certificate validity dates using pattern matching
    // Look for UTCTime or GeneralizedTime tags
    const certString = binaryStr;

    // UTCTime format: YYMMDDHHMMSSZ (tag 0x17)
    // GeneralizedTime format: YYYYMMDDHHMMSSZ (tag 0x18)
    // eslint-disable-next-line no-control-regex
    const utcTimeRegex = /\x17(\d{10})Z/gu;
    // eslint-disable-next-line no-control-regex
    const genTimeRegex = /\x18(\d{14})Z/gu;

    const utcTimes: string[] = [];
    const genTimes: string[] = [];
    let match;

    while ((match = utcTimeRegex.exec(certString)) !== null) {
      utcTimes.push(match[1]);
    }
    while ((match = genTimeRegex.exec(certString)) !== null) {
      genTimes.push(match[1]);
    }

    // UTCTimes are typically: notBefore, notAfter in that order
    if (utcTimes.length >= 2) {
      const notBeforeRaw = utcTimes[0];
      const notAfterRaw = utcTimes[1];

      // Parse UTCTime format: YYMMDDHHMMSS
      const notBeforeDate = new Date(
        2000 + parseInt(notBeforeRaw.substring(0, 2)),
        parseInt(notBeforeRaw.substring(2, 4)) - 1,
        parseInt(notBeforeRaw.substring(4, 6)),
        parseInt(notBeforeRaw.substring(6, 8)),
        parseInt(notBeforeRaw.substring(8, 10)),
        parseInt(notBeforeRaw.substring(10, 12))
      );

      const notAfterDate = new Date(
        2000 + parseInt(notAfterRaw.substring(0, 2)),
        parseInt(notAfterRaw.substring(2, 4)) - 1,
        parseInt(notAfterRaw.substring(4, 6)),
        parseInt(notAfterRaw.substring(6, 8)),
        parseInt(notAfterRaw.substring(8, 10)),
        parseInt(notAfterRaw.substring(10, 12))
      );

      result.notBefore = notBeforeDate.toISOString();
      result.notAfter = notAfterDate.toISOString();
    }

    // Try to find serial number (tag 0x02 followed by length)
    // eslint-disable-next-line no-control-regex
    const serialMatch = certString.match(/\x02\x08([\x00-\xff]+)/u);
    if (serialMatch) {
      result.serialNumber = serialMatch[1]
        .split('')
        .map((b) => b.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    }

    // Try to extract CN from issuer (simplified)
    // Look for CN= pattern after issuer OID (2.5.4.3)
    // eslint-disable-next-line no-control-regex
    const cnMatch = certString.match(/CN=([^\x00-\x1F\x7F]+)/u);
    if (cnMatch) {
      result.issuer = cnMatch[1];
    }
  } catch (error) {
    console.error('[tls] Error parsing certificate:', error);
  }

  return result;
}

// Extract domain and SANs from certificate data
function extractDomains(certData: any): { domain: string; sans: string[] } {
  let domain = '';
  const sans: string[] = [];

  if (certData.domain) {
    if (typeof certData.domain === 'string') {
      domain = certData.domain;
    } else if (certData.domain.main) {
      domain = certData.domain.main;
      if (certData.domain.sans) {
        sans.push(...certData.domain.sans);
      }
    }
  }

  // If no domain found, try alternative structures
  if (!domain && certData.domains) {
    // Traefik might store domains differently
  }

  return { domain, sans };
}

tls.get('/certificates', async (c) => {
  try {
    const acmeJsonPath = config.paths.acmeJson;

    if (!acmeJsonPath || !(await Bun.file(acmeJsonPath).exists())) {
      return c.json({ certificates: [] });
    }

    const content = await Bun.file(acmeJsonPath).text();
    const acmeData = JSON.parse(content);

    const certificates: CertificateInfo[] = [];

    // Traefik acme.json format:
    // {
    //   "resolvername": {
    //     "Certificates": [
    //       {
    //         "domain": { "main": "example.com", "sans": ["www.example.com"] },
    //         "certificate": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    //         "key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
    //         "Store": ["main"]
    //       }
    //     ]
    //   }
    // }

    for (const resolverName of Object.keys(acmeData)) {
      const resolver = acmeData[resolverName];
      if (!resolver || !resolver.Certificates) continue;

      for (const cert of resolver.Certificates) {
        const { domain, sans } = extractDomains(cert);

        if (!domain) continue;

        let notBefore: string | null = null;
        let notAfter: string | null = null;
        let issuer: string | null = null;
        let serialNumber: string | null = null;
        let isExpired = false;

        if (cert.certificate) {
          const parsed = parseCertificateFields(cert.certificate);
          notBefore = parsed.notBefore;
          notAfter = parsed.notAfter;
          issuer = parsed.issuer;
          serialNumber = parsed.serialNumber;
        }

        if (notAfter) {
          const notAfterDate = new Date(notAfter);
          isExpired = notAfterDate < new Date();
        }

        certificates.push({
          domain,
          sans,
          notBefore,
          notAfter,
          issuer,
          serialNumber,
          isExpired,
        });
      }
    }

    return c.json({ certificates });
  } catch (error) {
    console.error('[tls] Error reading certificates:', error);
    return c.json({ error: 'Internal server error while reading certificates' }, 500);
  }
});

tls.get('/options', async (c) => {
  return c.json({ options: [] });
});

export { tls };
