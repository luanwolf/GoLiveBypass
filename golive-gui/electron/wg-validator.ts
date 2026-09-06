import dns from "node:dns/promises";
import net from "node:net";

export interface WgConfValidation {
  valid: boolean;
  error?: string;
  interfaceAddress?: string;
  endpoint?: string;
  resolvedIp?: string;
  dns?: string;
}

export function isValidWgKey(key: string): boolean {
  if (typeof key !== "string") return false;
  const trimmed = key.trim();
  if (trimmed.length !== 44) return false;
  if (!/^[A-Za-z0-9+/]{43}=$/.test(trimmed)) return false;
  try {
    const buf = Buffer.from(trimmed, "base64");
    return buf.length === 32;
  } catch {
    return false;
  }
}

export interface ParsedWgConf {
  interface: {
    privateKey?: string;
    address?: string;
    dns?: string;
    [key: string]: string | undefined;
  };
  peer: {
    publicKey?: string;
    endpoint?: string;
    allowedIPs?: string;
    [key: string]: string | undefined;
  };
}

export function parseWgConf(content: string): ParsedWgConf {
  const lines = content.split(/\r?\n/);
  let currentSection = "";
  const result: ParsedWgConf = {
    interface: {},
    peer: {},
  };

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("[") && line.endsWith("]")) {
      currentSection = line.slice(1, -1).trim().toLowerCase();
      continue;
    }

    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim().toLowerCase();
    const val = line.slice(eqIdx + 1).trim();

    if (currentSection === "interface") {
      if (key === "privatekey") result.interface.privateKey = val;
      else if (key === "address") result.interface.address = val;
      else if (key === "dns") result.interface.dns = val;
      else result.interface[key] = val;
    } else if (currentSection === "peer") {
      if (key === "publickey") result.peer.publicKey = val;
      else if (key === "endpoint") result.peer.endpoint = val;
      else if (key === "allowedips") result.peer.allowedIPs = val;
      else result.peer[key] = val;
    }
  }

  return result;
}

export function withAddressCidr(address: string): string {
  return address
    .split(",")
    .map((part) => {
      const value = part.trim();
      if (!value || value.includes("/")) return value;
      if (net.isIPv4(value)) return `${value}/32`;
      if (net.isIPv6(value)) return `${value}/128`;
      return value;
    })
    .filter(Boolean)
    .join(", ");
}

export function withIpv6CatchAll(allowedIPs: string): string {
  const parts = allowedIPs.split(",").map((part) => part.trim()).filter(Boolean);
  const hasV4All = parts.some((part) => part === "0.0.0.0/0");
  const hasV6All = parts.some((part) => part === "::/0");
  if (hasV4All && !hasV6All) parts.push("::/0");
  return parts.join(", ");
}

/** Kaspersky e outros .conf de roteador vêm só com IPv4; o Discord no Windows usa IPv6 e vaza no Brasil. */
export function rewriteWgConfForSplitTunnel(content: string): string {
  return content.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[")) return line;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return line;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (/^Address$/i.test(key)) return `Address = ${withAddressCidr(val)}`;
    if (/^AllowedIPs$/i.test(key)) return `AllowedIPs = ${withIpv6CatchAll(val)}`;
    return line;
  }).join("\n");
}

export async function validateWgConfContent(content: string): Promise<WgConfValidation> {
  if (!content || !content.trim()) {
    return { valid: false, error: "Arquivo de configuração está vazio." };
  }

  const parsed = parseWgConf(content);

  // Valida Interface
  if (!parsed.interface.privateKey && !parsed.interface.address) {
    return {
      valid: false,
      error: "Falta a seção [Interface] no arquivo de configuração.",
    };
  }

  if (!parsed.interface.privateKey) {
    return {
      valid: false,
      error: "Chave privada (PrivateKey) ausente na seção [Interface].",
    };
  }

  if (!isValidWgKey(parsed.interface.privateKey)) {
    return {
      valid: false,
      error: "Chave privada (PrivateKey) inválida. Deve ser uma chave Base64 de 32 bytes (44 caracteres).",
    };
  }

  if (!parsed.interface.address) {
    return {
      valid: false,
      error: "Endereço IP (Address) ausente na seção [Interface].",
    };
  }

  // Valida Peer
  if (!parsed.peer.publicKey && !parsed.peer.endpoint) {
    return {
      valid: false,
      error: "Falta a seção [Peer] no arquivo de configuração.",
    };
  }

  if (!parsed.peer.publicKey) {
    return {
      valid: false,
      error: "Chave pública do servidor (PublicKey) ausente na seção [Peer].",
    };
  }

  if (!isValidWgKey(parsed.peer.publicKey)) {
    return {
      valid: false,
      error: "Chave pública do servidor (PublicKey) inválida. Deve ser uma chave Base64 de 32 bytes (44 caracteres).",
    };
  }

  if (!parsed.peer.endpoint) {
    return {
      valid: false,
      error: "Endereço do servidor (Endpoint) ausente na seção [Peer].",
    };
  }

  // Valida formato do Endpoint: host:port ou [ipv6]:port
  const endpoint = parsed.peer.endpoint;
  let host = "";
  let portStr = "";

  if (endpoint.startsWith("[")) {
    const closeBracket = endpoint.indexOf("]");
    if (closeBracket === -1 || endpoint[closeBracket + 1] !== ":") {
      return {
        valid: false,
        error: "Formato de Endpoint IPv6 inválido. Use [ipv6]:porta.",
      };
    }
    host = endpoint.slice(1, closeBracket);
    portStr = endpoint.slice(closeBracket + 2);
  } else {
    const parts = endpoint.split(":");
    if (parts.length !== 2) {
      return {
        valid: false,
        error: "Formato de Endpoint inválido. Deve ser host:porta ou ip:porta.",
      };
    }
    host = parts[0];
    portStr = parts[1];
  }

  const port = parseInt(portStr, 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    return {
      valid: false,
      error: `Porta do Endpoint inválida: "${portStr}". Deve estar entre 1 e 65535.`,
    };
  }

  // Teste de DNS e conectividade do Endpoint
  let resolvedIp = host;
  const isDirectIp = net.isIP(host) !== 0;

  if (!isDirectIp) {
    try {
      const lookup = await dns.lookup(host);
      resolvedIp = lookup.address;
    } catch {
      return {
        valid: false,
        error: `Não foi possível resolver o domínio do Endpoint "${host}" via DNS.`,
      };
    }
  }

  return {
    valid: true,
    interfaceAddress: parsed.interface.address,
    endpoint: `${host}:${port}`,
    resolvedIp,
    dns: parsed.interface.dns,
  };
}
