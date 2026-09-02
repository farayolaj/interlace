---
"@interlace/core": fix
---

`serialize` now writes the authored content payload (`getData()`) into the
`data` field of each serialized item instead of the runtime `ContentState`
(`getState()`). The deserialize path already reads this field as the
content payload, so documents now round-trip with the user's authored data
intact. The serializer's signature is unchanged.

Documents serialized by previous versions store the runtime
`ContentState` string in `data`; `deserialize` will hand that string
to content types as the authored payload. Re-save authored documents
after upgrading.