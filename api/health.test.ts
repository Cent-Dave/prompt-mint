// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { connectDbMock } = vi.hoisted(() => ({
  connectDbMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../server/src/db/connectDb", () => ({
  default: connectDbMock,
}));

vi.mock("../server/src/models/IndexerState", () => ({
  IndexerState: {
    findOne: vi.fn().mockResolvedValue({ lastIndexedLedger: 12345 }),
  },
}));

import handler from "./health";

function makeReq(method: string = "GET") {
  return {
    method,
    headers: {},
    url: "/api/health",
    socket: { remoteAddress: "127.0.0.1" },
  };
}

function makeRes() {
  const res = {
    statusCode: 0 as number,
    body: undefined as any,
    writableEnded: false,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      res.writableEnded = true;
      return res;
    },
    setHeader(_name: string, _value: string) {
      return res;
    },
  };
  return res;
}

describe("GET /api/health", () => {
  const origContractId = process.env.PUBLIC_PROMPT_HASH_CONTRACT_ID;

  beforeEach(() => {
    process.env.PUBLIC_PROMPT_HASH_CONTRACT_ID =
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.PUBLIC_PROMPT_HASH_CONTRACT_ID = origContractId;
    vi.restoreAllMocks();
  });

  it("returns 200 and healthy status when contract and RPC are reachable", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(JSON.stringify({ result: { status: "healthy" } }), { status: 200 });
    });

    const res = makeRes();
    await handler(makeReq("GET"), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.rpc.status).toBe("up");
    expect(res.body.contractConfig.configured).toBe(true);
    expect(res.body.indexer.lastProcessedLedger).toBe(12345);
  });

  it("returns 503 degraded when RPC is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));

    const res = makeRes();
    await handler(makeReq("GET"), res);

    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.rpc.status).toBe("down");
  });
});
