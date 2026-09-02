import type { ApiResponse, ConduitClient } from '@api/conduitClient';

export type Method = 'get' | 'put' | 'post' | 'del';

// A table, not a chain of ternaries. Two tests walk a list of endpoints and have to turn the
// method *named in the list* into a call — `playwright/no-conditional-in-test` refuses branching
// inside a test body, and it is right about the category even where it is wrong about this
// instance: a test that branches asserts different things depending on what it meets, which is
// D-12 wearing another hat. Lifting the dispatch out is the honest answer; a disable comment
// would have left a four-deep nested ternary in a test and called it done.
//
// `data ?? {}` is here rather than at the call sites: `get` and `del` take no body, so a list
// entry for them carries none, and the two that do take one must still send something.
const CALLS: Record<
  Method,
  (client: ConduitClient, path: string, data?: unknown) => Promise<ApiResponse>
> = {
  get: (client, path) => client.get(path),
  del: (client, path) => client.del(path),
  put: (client, path, data) => client.put(path, data ?? {}),
  post: (client, path, data) => client.post(path, data ?? {}),
};

export function send(
  client: ConduitClient,
  method: Method,
  path: string,
  data?: unknown
): Promise<ApiResponse> {
  return CALLS[method](client, path, data);
}
