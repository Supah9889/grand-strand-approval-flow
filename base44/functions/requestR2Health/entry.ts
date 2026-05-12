Deno.serve(() => Response.json({ status: "ok" }, {
  headers: {
    "Cache-Control": "no-store",
  },
}));