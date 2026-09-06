import { describe, it, expect } from "vitest";
import { isValidWgKey, parseWgConf, rewriteWgConfForSplitTunnel, validateWgConfContent } from "../electron/wg-validator";

describe("WireGuard Validator", () => {
  it("valida chaves WireGuard corretamente", () => {
    // Chave válida de 32 bytes em Base64
    expect(isValidWgKey("EJmruxrw1y1dxNMn/MwWNjqh6RdtbrrajBqlnlxjoFw=")).toBe(true);
    expect(isValidWgKey("VIsNLxZusibbokXCLvUmRHmYhdIEUsWm+vGHoEvWd20=")).toBe(true);

    // Chaves inválidas
    expect(isValidWgKey("")).toBe(false);
    expect(isValidWgKey("abc")).toBe(false);
    expect(isValidWgKey("EJmruxrw1y1dxNMn/MwWNjqh6RdtbrrajBqlnlxjoF")).toBe(false); // 43 chars
    expect(isValidWgKey("EJmruxrw1y1dxNMn/MwWNjqh6RdtbrrajBqlnlxjoFw==")).toBe(false); // 45 chars
  });

  it("parseia arquivo .conf corretamente", () => {
    const conf = `
[Interface]
PrivateKey = EJmruxrw1y1dxNMn/MwWNjqh6RdtbrrajBqlnlxjoFw=
Address = 10.2.0.2/32
DNS = 10.2.0.1

[Peer]
PublicKey = VIsNLxZusibbokXCLvUmRHmYhdIEUsWm+vGHoEvWd20=
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = 84.20.27.50:51820
`;
    const parsed = parseWgConf(conf);
    expect(parsed.interface.privateKey).toBe("EJmruxrw1y1dxNMn/MwWNjqh6RdtbrrajBqlnlxjoFw=");
    expect(parsed.interface.address).toBe("10.2.0.2/32");
    expect(parsed.interface.dns).toBe("10.2.0.1");
    expect(parsed.peer.publicKey).toBe("VIsNLxZusibbokXCLvUmRHmYhdIEUsWm+vGHoEvWd20=");
    expect(parsed.peer.endpoint).toBe("84.20.27.50:51820");
  });

  it("completa .conf IPv4-only com mascara e catch-all IPv6", () => {
    const out = rewriteWgConfForSplitTunnel(`[Interface]
PrivateKey = EJmruxrw1y1dxNMn/MwWNjqh6RdtbrrajBqlnlxjoFw=
Address=172.21.95.103
[Peer]
PublicKey = VIsNLxZusibbokXCLvUmRHmYhdIEUsWm+vGHoEvWd20=
AllowedIPs=0.0.0.0/0
Endpoint=sx370703-ikev.dnsdialer.com:51820
`);
    expect(out).toContain("Address = 172.21.95.103/32");
    expect(out).toContain("AllowedIPs = 0.0.0.0/0, ::/0");
  });

  it("nao duplica ::/0 quando o perfil ja e dual-stack", () => {
    const src = `[Peer]
AllowedIPs = 0.0.0.0/0, ::/0
`;
    expect(rewriteWgConfForSplitTunnel(src)).toContain("AllowedIPs = 0.0.0.0/0, ::/0");
    expect(rewriteWgConfForSplitTunnel(src).match(/::\/0/g)?.length).toBe(1);
  });

  it("valida configuracao valida com IP direto", async () => {
    const validConf = `
[Interface]
PrivateKey = EJmruxrw1y1dxNMn/MwWNjqh6RdtbrrajBqlnlxjoFw=
Address = 10.2.0.2/32
DNS = 1.1.1.1

[Peer]
PublicKey = VIsNLxZusibbokXCLvUmRHmYhdIEUsWm+vGHoEvWd20=
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = 84.20.27.50:51820
`;
    const res = await validateWgConfContent(validConf);
    expect(res.valid).toBe(true);
    expect(res.endpoint).toBe("84.20.27.50:51820");
    expect(res.resolvedIp).toBe("84.20.27.50");
    expect(res.interfaceAddress).toBe("10.2.0.2/32");
  });

  it("rejeita configuracao sem chave privada ou com chave corrompida", async () => {
    const badKeyConf = `
[Interface]
PrivateKey = invalid_key_here
Address = 10.2.0.2/32

[Peer]
PublicKey = VIsNLxZusibbokXCLvUmRHmYhdIEUsWm+vGHoEvWd20=
Endpoint = 84.20.27.50:51820
`;
    const res = await validateWgConfContent(badKeyConf);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Chave privada (PrivateKey) inválida");
  });

  it("rejeita configuracao sem endpoint ou com endpoint invalido", async () => {
    const badEndpointConf = `
[Interface]
PrivateKey = EJmruxrw1y1dxNMn/MwWNjqh6RdtbrrajBqlnlxjoFw=
Address = 10.2.0.2/32

[Peer]
PublicKey = VIsNLxZusibbokXCLvUmRHmYhdIEUsWm+vGHoEvWd20=
Endpoint = 84.20.27.50:999999
`;
    const res = await validateWgConfContent(badEndpointConf);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Porta do Endpoint inválida");
  });

  it("rejeita arquivo vazio ou sem secoes necessarias", async () => {
    const emptyRes = await validateWgConfContent("");
    expect(emptyRes.valid).toBe(false);

    const noPeer = await validateWgConfContent(`
[Interface]
PrivateKey = EJmruxrw1y1dxNMn/MwWNjqh6RdtbrrajBqlnlxjoFw=
Address = 10.2.0.2/32
`);
    expect(noPeer.valid).toBe(false);
    expect(noPeer.error).toContain("[Peer]");
  });
});
