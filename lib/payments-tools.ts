const HEX = "0123456789ABCDEF";

export function encodeHex(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value), (byte) =>
    byte.toString(16).padStart(2, "0").toUpperCase(),
  );
  return JSON.stringify(
    {
      text: value,
      hexSpaced: bytes.join(" "),
      hexCompact: bytes.join(""),
      byteLength: bytes.length,
    },
    null,
    2,
  );
}

export function decodeHex(value: string) {
  const clean = value
    .replace(/0x/gi, "")
    .replace(/[\s:,-]/g, "")
    .toUpperCase();
  if (!/^[0-9A-F]+$/.test(clean))
    throw new Error(
      "Enter hexadecimal bytes separated by spaces, colons or dashes.",
    );
  if (!clean || clean.length % 2)
    throw new Error("Enter an even-length hexadecimal value.");
  const bytes = Uint8Array.from({ length: clean.length / 2 }, (_, index) =>
    parseInt(clean.slice(index * 2, index * 2 + 2), 16),
  );
  return JSON.stringify(
    {
      hexSpaced: Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, "0").toUpperCase(),
      ).join(" "),
      text: new TextDecoder("utf-8", { fatal: false }).decode(bytes),
      byteLength: bytes.length,
    },
    null,
    2,
  );
}

export function hexToBinary(value: string) {
  const clean = value.replace(/0x/gi, "").replace(/\s/g, "");
  if (!/^[0-9a-f]+$/i.test(clean))
    throw new Error("Enter hexadecimal characters only.");
  return clean
    .toUpperCase()
    .split("")
    .map(
      (char) => `${char}  ${parseInt(char, 16).toString(2).padStart(4, "0")}`,
    )
    .join("\n");
}

export function binaryToHex(value: string) {
  const clean = value.replace(/\s/g, "");
  if (!/^[01]+$/.test(clean)) throw new Error("Enter binary digits only.");
  const padded = clean.padStart(Math.ceil(clean.length / 4) * 4, "0");
  return (
    padded
      .match(/.{4}/g)
      ?.map((nibble) => HEX[parseInt(nibble, 2)])
      .join("") ?? ""
  );
}

export function encodeBcd(value: string) {
  const digits = value.replace(/\s/g, "");
  if (!/^\d+$/.test(digits))
    throw new Error("BCD input must contain digits only.");
  const padded = digits.length % 2 ? `0${digits}` : digits;
  return (
    padded
      .match(/../g)
      ?.map(
        (pair) =>
          `${parseInt(pair[0], 10).toString(16)}${parseInt(pair[1], 10).toString(16)}`,
      )
      .join(" ")
      .toUpperCase() ?? ""
  );
}

export function decodeBcd(value: string) {
  const clean = value.replace(/\s/g, "").toUpperCase();
  if (!/^[0-9]+F?$/.test(clean) || clean.length % 2)
    throw new Error(
      "Enter packed BCD bytes such as 12 34 56. A trailing F nibble may be used as an odd-digit filler.",
    );
  const nibbles = clean.split("");
  if (nibbles.includes("F") && nibbles[nibbles.length - 1] !== "F")
    throw new Error("Only the final BCD nibble may be F filler.");
  return nibbles
    .filter((nibble) => nibble !== "F")
    .join("")
    .replace(/^0(?=\d)/, "");
}

// IBM037 is the common EBCDIC code page used by mainframe/payment hosts.
// Control bytes are rendered as escapes so decoded output remains readable.
const EBCDIC_CP037 =
  "\u0000\u0001\u0002\u0003\u009c\t\u0086\u007f\u0097\u008d\u008e\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u009d\u0085\b\u0087\u0018\u0019\u0092\u008f\u001c\u001d\u001e\u001f\u0080\u0081\u0082\u0083\u0084\n\u0017\u001b\u0088\u0089\u008a\u008b\u008c\u0005\u0006\u0007\u0090\u0091\u0016\u0093\u0094\u0095\u0096\u0004\u0098\u0099\u009a\u009b\u0014\u0015\u009e\u001a \u00a0\u00e2\u00e4\u00e0\u00e1\u00e3\u00e5\u00e7\u00f1\u00a2.<(+|&\u00e9\u00ea\u00eb\u00e8\u00ed\u00ee\u00ef\u00ec\u00df!$*);\u00ac-/\u00c2\u00c4\u00c0\u00c1\u00c3\u00c5\u00c7\u00d1\u00a6,%_>?\u00f8\u00c9\u00ca\u00cb\u00c8\u00cd\u00ce\u00cf\u00cc`:#@'=\"\u00d8abcdefghi\u00ab\u00bb\u00f0\u00fd\u00fe\u00b1\u00b0jklmnopqr\u00aa\u00ba\u00e6\u00b8\u00c6\u00a4\u00b5~stuvwxyz\u00a1\u00bf\u00d0\u00dd\u00de\u00ae^\u00a3\u00a5\u00b7\u00a9\u00a7\u00b6\u00bc\u00bd\u00be[]\u00af\u00a8\u00b4\u00d7{ABCDEFGHI\u00ad\u00f4\u00f6\u00f2\u00f3\u00f5}JKLMNOPQR\u00b9\u00fb\u00fc\u00f9\u00fa\u00ff\\\u00f7STUVWXYZ\u00b2\u00d4\u00d6\u00d2\u00d3\u00d50123456789\u00b3\u00db\u00dc\u00d9\u00da\u009f";

export function decodeEbcdic(value: string) {
  const clean = value.replace(/0x/gi, "").replace(/\s/g, "");
  if (!/^[0-9a-f]+$/i.test(clean) || clean.length % 2)
    throw new Error("Enter EBCDIC bytes in hexadecimal.");
  return (clean.match(/../g) ?? [])
    .map((byte) => {
      const code = parseInt(byte, 16);
      const character = EBCDIC_CP037[code];
      return character && character >= " " && character !== "\u007f"
        ? character
        : `\\x${byte}`;
    })
    .join("");
}

export function parseBitmap(value: string) {
  const clean = value.replace(/0x/gi, "").replace(/\s/g, "").toUpperCase();
  if (!/^[0-9A-F]+$/.test(clean) || ![16, 32].includes(clean.length))
    throw new Error("Enter an 8-byte or 16-byte bitmap in hexadecimal.");
  const fields: number[] = [];
  const bits = clean
    .split("")
    .flatMap((char) =>
      parseInt(char, 16).toString(2).padStart(4, "0").split(""),
    );
  const secondaryBitmap = bits[0] === "1";
  if (secondaryBitmap && clean.length === 16)
    throw new Error(
      "The primary bitmap sets bit 1; provide the 16-byte bitmap including its secondary half.",
    );
  bits.forEach((bit, index) => {
    if (bit === "1" && index > 0) fields.push(index + 1);
  });
  return JSON.stringify(
    {
      bytes: clean.length / 2,
      secondaryBitmap,
      enabledDataElements: fields.filter((field) => field !== 1),
    },
    null,
    2,
  );
}

const ISO_FIELDS: Record<
  number,
  { name: string; type: "fixed" | "llvar" | "lllvar"; length: number }
> = {
  2: { name: "Primary account number", type: "llvar", length: 19 },
  3: { name: "Processing code", type: "fixed", length: 6 },
  4: { name: "Transaction amount", type: "fixed", length: 12 },
  7: { name: "Transmission date/time", type: "fixed", length: 10 },
  11: { name: "Systems trace audit number", type: "fixed", length: 6 },
  12: { name: "Local transaction time", type: "fixed", length: 6 },
  13: { name: "Local transaction date", type: "fixed", length: 4 },
  14: { name: "Expiration date", type: "fixed", length: 4 },
  18: { name: "Merchant category code", type: "fixed", length: 4 },
  22: { name: "POS entry mode", type: "fixed", length: 3 },
  25: { name: "POS condition code", type: "fixed", length: 2 },
  32: { name: "Acquiring institution ID", type: "llvar", length: 11 },
  35: { name: "Track 2 data", type: "llvar", length: 37 },
  37: { name: "Retrieval reference number", type: "fixed", length: 12 },
  38: { name: "Authorization ID response", type: "fixed", length: 6 },
  39: { name: "Response code", type: "fixed", length: 2 },
  41: { name: "Card acceptor terminal ID", type: "fixed", length: 8 },
  42: { name: "Card acceptor ID", type: "fixed", length: 15 },
  43: { name: "Card acceptor name/location", type: "fixed", length: 40 },
  48: { name: "Additional data", type: "lllvar", length: 999 },
  49: { name: "Transaction currency code", type: "fixed", length: 3 },
  52: { name: "PIN data", type: "fixed", length: 16 },
  55: { name: "ICC data", type: "lllvar", length: 999 },
  60: { name: "Reserved national", type: "lllvar", length: 999 },
  62: { name: "Reserved private", type: "lllvar", length: 999 },
  63: { name: "Reserved private", type: "lllvar", length: 999 },
  64: { name: "Message authentication code", type: "fixed", length: 16 },
};

function unpackIso8583Raw(value: string) {
  const clean = value.replace(/[\s:,-]/g, "").toUpperCase();
  if (!/^[0-9A-F]+$/.test(clean) || clean.length < 20)
    throw new Error(
      "Raw ISO 8583 input must be hexadecimal MTI/bitmap data, or use MTI=... lines.",
    );
  const asciiMti = /^[0-9]{4}/.test(clean);
  const encodedMtiBytes = Uint8Array.from({ length: 4 }, (_, index) =>
    parseInt(clean.slice(index * 2, index * 2 + 2), 16),
  );
  const encodedMtiValue = new TextDecoder().decode(encodedMtiBytes);
  const encodedMti = /^[0-9]{4}$/.test(encodedMtiValue);
  const mti = encodedMti ? encodedMtiValue : clean.slice(0, 4);
  let offset = encodedMti ? 8 : 4;
  if (!asciiMti && !encodedMti)
    throw new Error("Raw ISO 8583 input must start with a four-digit MTI.");
  const primary = clean.slice(offset, offset + 16);
  offset += 16;
  const hasSecondary = (parseInt(primary.slice(0, 2), 16) & 0x80) !== 0;
  const bitmap = hasSecondary
    ? `${primary}${clean.slice(offset, offset + 16)}`
    : primary;
  if (hasSecondary) offset += 16;
  const enabled = JSON.parse(parseBitmap(bitmap))
    .enabledDataElements as number[];
  const fields: Record<string, unknown> = {};
  const errors: string[] = [];
  for (const field of enabled) {
    const spec = ISO_FIELDS[field];
    if (!spec) {
      errors.push(
        `DE${field}: no generic field definition; remaining payload not consumed.`,
      );
      continue;
    }
    let length = spec.length;
    if (spec.type === "llvar" || spec.type === "lllvar") {
      const digits = spec.type === "llvar" ? 2 : 3;
      length = Number(clean.slice(offset, offset + digits));
      offset += digits;
    }
    const data = clean.slice(offset, offset + length);
    offset += length;
    if (data.length !== length)
      errors.push(
        `DE${field}: expected ${length} characters, received ${data.length}.`,
      );
    fields[String(field)] = {
      name: spec.name,
      type: spec.type,
      length,
      value: field === 2 || field === 35 ? maskPan(data) : data,
    };
  }
  return {
    mti,
    bitmap,
    fields,
    consumed: offset,
    payloadLength: clean.length,
    errors,
  };
}

export function parseIso8583(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const entries = Object.fromEntries(
    lines
      .filter((line) => line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
  if (!Object.keys(entries).length)
    return JSON.stringify(unpackIso8583Raw(value), null, 2);
  const bitmap = entries.BITMAP ?? entries.bitmap;
  return JSON.stringify(
    {
      mti: entries.MTI ?? entries.mti ?? "unknown",
      bitmap: bitmap ? JSON.parse(parseBitmap(bitmap)) : null,
      fields: Object.fromEntries(
        Object.entries(entries)
          .filter(([key]) => !/^(MTI|BITMAP)$/i.test(key))
          .map(([key, fieldValue]) => [
            key,
            {
              name:
                ISO_FIELDS[Number(key)]?.name ??
                "Custom / scheme-specific field",
              value: /^2$|^35$/.test(key) ? maskPan(fieldValue) : fieldValue,
            },
          ]),
      ),
    },
    null,
    2,
  );
}

export function parseEmvTlv(value: string) {
  const clean = value
    .replace(/0x/gi, "")
    .replace(/[\s:,-]/g, "")
    .toUpperCase();
  if (!clean || !/^[0-9A-F]+$/.test(clean) || clean.length % 2)
    throw new Error("Enter an even-length BER-TLV hexadecimal value.");
  type Tlv = {
    tag: string;
    length: number;
    value: string;
    constructed: boolean;
    children?: Tlv[];
  };
  const parseSequence = (sequence: string, depth: number): Tlv[] => {
    if (depth > 32) throw new Error("BER-TLV nesting is too deep.");
    const tags: Tlv[] = [];
    let offset = 0;
    while (offset < sequence.length) {
      const first = sequence.slice(offset, offset + 2);
      if (first.length < 2) throw new Error("Incomplete BER-TLV tag.");
      offset += 2;
      let tag = first;
      if ((parseInt(first, 16) & 0x1f) === 0x1f) {
        let next = "";
        do {
          next = sequence.slice(offset, offset + 2);
          if (next.length < 2)
            throw new Error("Incomplete BER-TLV multi-byte tag.");
          tag += next;
          offset += 2;
        } while (parseInt(next, 16) & 0x80);
      }
      if (offset + 2 > sequence.length)
        throw new Error(`Tag ${tag} is missing a length byte.`);
      const lengthByte = parseInt(sequence.slice(offset, offset + 2), 16);
      offset += 2;
      let length = lengthByte;
      if (lengthByte & 0x80) {
        const count = lengthByte & 0x7f;
        if (!count || count > 4 || offset + count * 2 > sequence.length)
          throw new Error(`Tag ${tag} has an invalid BER length.`);
        length = parseInt(sequence.slice(offset, offset + count * 2), 16);
        offset += count * 2;
      }
      const bytes = sequence.slice(offset, offset + length * 2);
      if (bytes.length !== length * 2)
        throw new Error(
          `Tag ${tag} declares ${length} bytes but only ${bytes.length / 2} remain.`,
        );
      offset += length * 2;
      const constructed = (parseInt(first, 16) & 0x20) !== 0;
      tags.push({
        tag,
        length,
        value: bytes,
        constructed,
        ...(constructed ? { children: parseSequence(bytes, depth + 1) } : {}),
      });
    }
    return tags;
  };
  return JSON.stringify(parseSequence(clean, 0), null, 2);
}

export function luhn(value: string) {
  if (!/^[\d\s-]+$/.test(value.trim()))
    throw new Error("Enter digits, spaces or dashes for a Luhn check.");
  const digits = value.replace(/\D/g, "");
  if (!digits) throw new Error("Enter digits for a Luhn check.");
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  let bodySum = 0;
  double = true;
  for (let index = digits.length - 2; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    bodySum += digit;
    double = !double;
  }
  return JSON.stringify(
    {
      valid: sum % 10 === 0,
      checkDigit: (10 - (bodySum % 10)) % 10,
      masked: maskPan(digits),
    },
    null,
    2,
  );
}

export function maskPan(value: string) {
  const raw = value.replace(/\s/g, "");
  const alreadyMasked = /[*•]/.test(raw);
  const digits = raw.replace(/\D/g, "");
  if (alreadyMasked) {
    const visiblePrefix = digits.slice(0, 6);
    const visibleSuffix = digits.slice(-4);
    const maskedCount = Math.max(
      0,
      raw.length - visiblePrefix.length - visibleSuffix.length,
    );
    return `${visiblePrefix}${"•".repeat(maskedCount)}${visibleSuffix}`;
  }
  return digits.length < 10
    ? digits.replace(/.(?=.{4})/g, "•")
    : `${digits.slice(0, 6)}${"•".repeat(Math.max(0, digits.length - 10))}${digits.slice(-4)}`;
}

export function parseTrack2(value: string) {
  const clean = value.trim().replace(/;|\?/g, "");
  const [account, rest] = clean.split(/[=D]/);
  if (!account || !rest)
    throw new Error(
      "Use Track 2 format PAN=YYMM... (masked input recommended).",
    );
  if (!/^[0-9*]+$/.test(account) || account.length > 19)
    throw new Error(
      "Track 2 PAN must contain at most 19 digits or masking asterisks.",
    );
  if (!/^\d{7}[0-9*]*$/.test(rest))
    throw new Error(
      "Track 2 data must start with YYMM and a three-digit service code.",
    );
  return JSON.stringify(
    {
      pan: maskPan(account),
      expiryYYMM: rest.slice(0, 4),
      serviceCode: rest.slice(4, 7),
      discretionaryData: rest.slice(7),
      warning:
        "Sensitive payment data must remain masked and must never be pasted into a shared environment.",
    },
    null,
    2,
  );
}
