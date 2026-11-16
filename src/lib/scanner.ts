import net from "net";
export async function scan(bytes: Buffer): Promise<"clean" | "infected" | "development-unscanned"> {
  const mode = process.env.SCANNER_DRIVER || "development";
  if (mode === "development") {
    if (process.env.NODE_ENV === "production") throw new Error("A malware scanner is required in production.");
    return bytes.includes(Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")) ? "infected" : "development-unscanned";
  }
  if (mode !== "clamav") throw new Error("Invalid SCANNER_DRIVER.");
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: process.env.CLAMAV_HOST || "127.0.0.1", port: Number(process.env.CLAMAV_PORT || 3310) });
    let answer = "", settled = false;
    const finish = (error?: Error, result?: "clean" | "infected") => {
      if (settled) return;
      settled = true; clearTimeout(deadline);
      if (error) reject(error); else resolve(result!);
      socket.destroy();
    };
    const deadline = setTimeout(() => finish(new Error("Scanner timed out.")), 60000);
    socket.setTimeout(60000, () => finish(new Error("Scanner timed out.")));
    socket.on("error", error => finish(error));
    socket.on("close", () => { if (!settled) finish(new Error("Scanner closed before a complete verdict.")); });
    socket.on("data", data => { answer += data.toString(); if (answer.length > 4096) finish(new Error("Invalid scanner response.")); });
    socket.on("end", () => {
      if (/^stream: .+ FOUND(?:\0|\n)?$/.test(answer)) finish(undefined, "infected");
      else if (/^stream: OK(?:\0|\n)?$/.test(answer)) finish(undefined, "clean");
      else finish(new Error("Scanner unavailable."));
    });
    const write = (data: string | Buffer): Promise<void> => {
      if (settled) return Promise.reject(new Error("Scanner connection ended."));
      if (socket.write(data)) return Promise.resolve();
      return new Promise((done, fail) => {
        const cleanup = () => { socket.off("drain", drained); socket.off("error", failed); socket.off("close", closed); };
        const drained = () => { cleanup(); done(); };
        const failed = (error: Error) => { cleanup(); fail(error); };
        const closed = () => { cleanup(); fail(new Error("Scanner closed during upload.")); };
        socket.once("drain", drained); socket.once("error", failed); socket.once("close", closed);
      });
    };
    socket.on("connect", async () => {
      try {
        await write("zINSTREAM\0");
        for (let offset = 0; offset < bytes.length; offset += 65536) {
          const chunk = bytes.subarray(offset, offset + 65536), length = Buffer.alloc(4);
          length.writeUInt32BE(chunk.length); await write(Buffer.concat([length, chunk]));
        }
        await write(Buffer.alloc(4));
      } catch (error: any) { finish(error); }
    });
  });
}
